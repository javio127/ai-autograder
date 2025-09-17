import type { NextApiRequest, NextApiResponse } from 'next'
import { gradeWithLLM } from '@/lib/grading/deterministicGrader'
import type { SubmissionPayload, Canonical } from '@/lib/grading/types'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

type GradeRequestBody = {
	submissionId: string
	payload: {
		source: 'vision' | 'typed' | 'typed_fallback'
		extractedValue: string
		extractedUnits?: string
		confidence?: number
	}
	canonical: Canonical
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).end()
	const { submissionId, payload, canonical } = req.body as GradeRequestBody
	if (!submissionId || !payload || !canonical) return res.status(400).json({ error: 'Missing fields' })
	
	// Convert the raw extracted value into a proper SubmissionPayload
	// The key insight: let our grading system determine types and handle comparison intelligently
	const submissionPayload: SubmissionPayload = {
		source: payload.source,
		type: canonical.type, // Start with expected type, but let LLM handle mismatches
		ocrConf: payload.confidence,
		// Populate all possible payload types with the extracted value
		numeric: canonical.type === 'numeric' ? { 
			num: payload.extractedValue, 
			units: payload.extractedUnits || null 
		} : undefined,
		mc: canonical.type === 'mc' ? { 
			choice: payload.extractedValue 
		} : undefined,
		short: canonical.type === 'short' ? { 
			text: payload.extractedValue 
		} : undefined,
		algebra: canonical.type === 'algebra' ? { 
			expression: payload.extractedValue 
		} : undefined,
	}

	// Use LLM grading for algebra, deterministic for others
	const graded = await gradeWithLLM(submissionPayload, canonical)

	// Persist (best-effort). Requires a real student_id/problem_id in production.
	try {
		const admin = getSupabaseAdmin()
		const parts = submissionId.split(':')
		const pid = parts[1]
		const student = parts[2]
		if (pid && student) {
			const { error: upsertError } = await admin.from('submissions').upsert({
				student_id: student,
				problem_id: pid,
				final_answer_source: payload.source,
				final_answer_json: (payload as unknown) as Record<string, unknown>,
				ocr_conf: payload.confidence ?? null,
				result: graded.result,
				score: graded.score,
				reasons: (graded.reasons as unknown) as string[],
			})
			
			if (upsertError) {
				console.error('Failed to save submission:', upsertError)
			} else {
				console.log('Submission saved successfully for student:', student, 'problem:', pid)
			}
		} else {
			console.error('Invalid submission ID format:', submissionId)
		}
	} catch (error) {
		console.error('Database error when saving submission:', error)
	}

	return res.status(200).json(graded)
}
