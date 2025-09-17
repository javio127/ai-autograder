import OpenAI from 'openai'

// LLM-based algebra expression matching
export async function matchAlgebraExpressions(
	submitted: string,
	correct: string,
	synonyms: string[] = []
): Promise<{ match: boolean; confidence: number; reason: string }> {
	
	// Quick fallback for empty inputs
	if (!submitted.trim() || !correct.trim()) {
		return { match: false, confidence: 1.0, reason: 'Empty expression' }
	}

	// Simple exact match first (fast path)
	if (submitted.trim() === correct.trim()) {
		return { match: true, confidence: 1.0, reason: 'Exact match' }
	}

	// Check synonyms
	if (synonyms.some(syn => submitted.trim() === syn.trim())) {
		return { match: true, confidence: 1.0, reason: 'Synonym match' }
	}

	try {
		const openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		})

		const allCorrectExpressions = [correct, ...synonyms].join(', ')
		
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini', // Fast and cheap for this task
			messages: [
				{
					role: 'system',
					content: `You are a math tutor checking if two algebraic expressions are equivalent.

Rules:
- Return "MATCH" if the expressions are mathematically equivalent
- Return "NO_MATCH" if they are different
- Consider different notations: √ vs sqrt(), π vs pi, x² vs x^2, etc.
- Consider different ordering: 5x + 2√15 = 2√15 + 5x
- Consider implicit multiplication: 2πr = 2*pi*r
- Be strict: only match if truly mathematically equivalent
- Ignore whitespace and capitalization

Format: Just respond with "MATCH" or "NO_MATCH" followed by a brief reason.`
				},
				{
					role: 'user',
					content: `Student wrote: "${submitted}"
Correct answer(s): ${allCorrectExpressions}

Are these equivalent?`
				}
			],
			max_tokens: 50,
			temperature: 0, // Deterministic
		})

		const result = response.choices[0]?.message?.content?.trim() || ''
		const isMatch = result.toUpperCase().startsWith('MATCH')
		const reason = result.replace(/^(MATCH|NO_MATCH)\s*-?\s*/i, '') || 'LLM decision'

		return {
			match: isMatch,
			confidence: 0.95, // High confidence in LLM for algebra
			reason: `LLM: ${reason}`
		}

	} catch (error) {
		console.error('LLM algebra matching failed:', error)
		
		// Fallback to simple normalization matching
		const normalizeSimple = (expr: string) => expr
			.toLowerCase()
			.replace(/\s+/g, '')
			.replace(/√/g, 'sqrt')
			.replace(/π/g, 'pi')
			.replace(/²/g, '^2')
			.replace(/³/g, '^3')

		const normalizedSubmitted = normalizeSimple(submitted)
		const normalizedCorrect = normalizeSimple(correct)
		const normalizedSynonyms = synonyms.map(normalizeSimple)

		const match = normalizedSubmitted === normalizedCorrect || 
					  normalizedSynonyms.includes(normalizedSubmitted)

		return {
			match,
			confidence: 0.7, // Lower confidence for fallback
			reason: match ? 'Fallback normalization match' : 'Fallback normalization mismatch'
		}
	}
}
