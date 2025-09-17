import { type GradeResponse, type SubmissionPayload, type Canonical } from './types'
import { matchAlgebraExpressions } from './llmAlgebraGrader'

function parseNumber(input: string): number | null {
	const trimmed = input.trim()
	// Accept fractions like 3/4
	if (/^[-+]?\d+\/\d+$/.test(trimmed)) {
		const [n, d] = trimmed.split('/').map(Number)
		if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null
		return n / d
	}
	// Scientific and decimal
	const num = Number(trimmed)
	return Number.isFinite(num) ? num : null
}

function normalizeAlgebraExpression(expr: string): string {
	let result = expr.trim().toLowerCase()
	
	// Convert Unicode symbols to ASCII equivalents
	result = result.replace(/√(\d+)/g, 'sqrt($1)')  // √15 → sqrt(15)
	result = result.replace(/√([a-zA-Z])/g, 'sqrt($1)')  // √x → sqrt(x)  
	result = result.replace(/√\(([^)]+)\)/g, 'sqrt($1)')  // √(x+1) → sqrt(x+1)
	result = result.replace(/√/g, 'sqrt')  // standalone √ → sqrt
	result = result.replace(/∛/g, 'cbrt')
	result = result.replace(/π/g, 'pi')
	result = result.replace(/∞/g, 'infinity')
	result = result.replace(/²/g, '^2')
	result = result.replace(/³/g, '^3')
	result = result.replace(/⁴/g, '^4')
	result = result.replace(/⁵/g, '^5')
	result = result.replace(/⁶/g, '^6')
	result = result.replace(/⁷/g, '^7')
	result = result.replace(/⁸/g, '^8')
	result = result.replace(/⁹/g, '^9')
	result = result.replace(/⁰/g, '^0')
	result = result.replace(/¹/g, '^1')
	
	// Normalize multiplication symbols
	result = result.replace(/×/g, '*')
	result = result.replace(/·/g, '*')
	result = result.replace(/•/g, '*')
	
	// Normalize division symbols
	result = result.replace(/÷/g, '/')
	
	// Normalize sqrt() notation - ensure parentheses
	result = result.replace(/sqrt(\d+)/g, 'sqrt($1)')  // sqrt15 → sqrt(15)
	result = result.replace(/sqrt([a-zA-Z])/g, 'sqrt($1)')  // sqrtx → sqrt(x)
	
	// Remove all spaces first, then add explicit multiplication where needed
	result = result.replace(/\s+/g, '')
	
	// Add multiplication between number and variable/function: 2x → 2*x, 2sqrt → 2*sqrt
	result = result.replace(/(\d+)([a-z])/g, '$1*$2')
	
	// Add multiplication between variable and number: x2 → x*2
	result = result.replace(/([a-z])(\d+)/g, '$1*$2')
	
	// Add multiplication between adjacent variables (but be careful with function names)
	// This is tricky, so for now we'll be conservative and only handle single letters
	result = result.replace(/([a-z])([a-z])(?![a-z])/g, '$1*$2')  // xy → x*y (but not "sqrt")
	
	return result
}

export function gradeDeterministic(
	payload: SubmissionPayload,
	canonical: Canonical
): GradeResponse {
	const reasons: string[] = []

	if (payload.type !== canonical.type) {
		return { result: 'REVIEW', score: 0, reasons: ['TYPE_MISMATCH'] }
	}

	if (payload.type === 'numeric' && canonical.type === 'numeric') {
		const cVal = (typeof canonical.value === 'string' ? canonical.value : canonical.value?.num) ?? ''
		const cUnits: string | undefined = typeof canonical.value === 'string' ? undefined : canonical.value?.units ?? undefined
		const customTolerance: number | undefined = typeof canonical.value === 'string' ? undefined : canonical.value?.tolerance ?? undefined
		const sText = payload.numeric?.num ?? ''
		const sUnits = payload.numeric?.units ?? undefined
		const sNum = parseNumber(String(sText))
		const cNum = parseNumber(String(cVal))
		if (sNum == null || cNum == null) {
			return { result: 'REVIEW', score: 0, reasons: ['NUM_PARSE_FAIL'] }
		}
		// Use custom tolerance if provided, otherwise use automatic tolerance
		const tol = customTolerance !== undefined ? customTolerance : Math.max(Math.abs(cNum) * 0.005, Math.abs(cNum) < 1 ? 0.01 : 0)
		const within = Math.abs(sNum - cNum) <= tol
		if (within) reasons.push(customTolerance !== undefined ? 'NUM_WITHIN_CUSTOM_TOL' : 'NUM_WITHIN_AUTO_TOL')
		if (cUnits) {
			if (sUnits && sUnits === cUnits) {
				reasons.push('UNITS_OK')
			} else {
				reasons.push('UNITS_MISSING_OR_MISMATCH')
			}
		}
		return { result: within ? 'PASS' : 'FAIL', score: within ? 1 : 0, reasons }
	}

	if (payload.type === 'mc' && canonical.type === 'mc') {
		const correct = String(canonical.value).trim()
		const choice = String(payload.mc?.choice ?? '').trim()
		const pass = !!choice && choice === correct
		return { result: pass ? 'PASS' : 'FAIL', score: pass ? 1 : 0, reasons: [pass ? 'MC_MATCH' : 'MC_MISMATCH'] }
	}

	if (payload.type === 'short' && canonical.type === 'short') {
		const base = canonical.value
		const correct = String((typeof base === 'string' ? base : base?.text) ?? '').trim().toLowerCase()
		let synonyms: string[] = []
		if (typeof base !== 'string' && Array.isArray(base?.synonyms)) {
			synonyms = base.synonyms
		}
		const submitted = String(payload.short?.text ?? '').trim().toLowerCase()
		const pass = !!submitted && (submitted === correct || synonyms.includes(submitted))
		return { result: pass ? 'PASS' : 'FAIL', score: pass ? 1 : 0, reasons: [pass ? 'SHORT_MATCH' : 'SHORT_MISMATCH'] }
	}

	if (payload.type === 'algebra' && canonical.type === 'algebra') {
		const base = canonical.value
		const correct = String((typeof base === 'string' ? base : base?.expression) ?? '').trim()
		let synonyms: string[] = []
		if (typeof base !== 'string' && Array.isArray(base?.synonyms)) {
			synonyms = base.synonyms.map((s: string) => s.trim())
		}
		const submitted = String(payload.algebra?.expression ?? '').trim()
		
		// For now, use simple string matching as fallback
		// TODO: Implement LLM-based semantic matching for algebra
		const normalizedSubmitted = normalizeAlgebraExpression(submitted)
		const normalizedCorrect = normalizeAlgebraExpression(correct)
		const normalizedSynonyms = synonyms.map(s => normalizeAlgebraExpression(s))
		
		const pass = !!normalizedSubmitted && (
			normalizedSubmitted === normalizedCorrect || 
			normalizedSynonyms.includes(normalizedSubmitted)
		)
		return { result: pass ? 'PASS' : 'FAIL', score: pass ? 1 : 0, reasons: [pass ? 'ALGEBRA_MATCH' : 'ALGEBRA_MISMATCH'] }
	}

	return { result: 'REVIEW', score: 0, reasons: ['UNHANDLED_TYPE'] }
}

// Async version that supports LLM-based algebra grading
export async function gradeWithLLM(
	payload: SubmissionPayload,
	canonical: Canonical
): Promise<GradeResponse> {
	// Handle all non-algebra types with deterministic grading
	if (payload.type !== 'algebra' || canonical.type !== 'algebra') {
		return gradeDeterministic(payload, canonical)
	}

	// Special LLM handling for algebra
	const base = canonical.value
	const correct = String((typeof base === 'string' ? base : base?.expression) ?? '').trim()
	let synonyms: string[] = []
	if (typeof base !== 'string' && Array.isArray(base?.synonyms)) {
		synonyms = base.synonyms.map((s: string) => s.trim())
	}
	const submitted = String(payload.algebra?.expression ?? '').trim()

	if (!submitted) {
		return { result: 'FAIL', score: 0, reasons: ['EMPTY_SUBMISSION'] }
	}

	try {
		const { match, confidence, reason } = await matchAlgebraExpressions(submitted, correct, synonyms)
		
		// Require high confidence for PASS
		if (match && confidence >= 0.9) {
			return { result: 'PASS', score: 1, reasons: [`ALGEBRA_LLM_MATCH: ${reason}`] }
		} else if (match && confidence >= 0.7) {
			return { result: 'REVIEW', score: 0.5, reasons: [`ALGEBRA_LLM_UNCERTAIN: ${reason}`] }
		} else {
			return { result: 'FAIL', score: 0, reasons: [`ALGEBRA_LLM_MISMATCH: ${reason}`] }
		}
	} catch (error) {
		console.error('LLM algebra grading failed:', error)
		// Fallback to deterministic grading
		return gradeDeterministic(payload, canonical)
	}
}
