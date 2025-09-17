import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

const USE_LLM = process.env.USE_LLM === 'true'
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o-mini'
const VISION_CONF_THRESHOLD = Number(process.env.VISION_CONF_THRESHOLD || '0.98')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type VisionExtractRequest = {
	imageBase64: string
	expectedType: 'numeric' | 'mc' | 'short' | 'algebra'
	expectedUnits?: string
	precheckConf?: number
}

type ExtractJSON = {
	value?: string
	units?: string
	confidence?: number
	abstain?: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).end()
	const { imageBase64, expectedType, expectedUnits } = req.body as VisionExtractRequest
	if (!imageBase64 || !expectedType) return res.status(400).json({ error: 'Missing fields' })

	// Basic request info
	console.log(`🔍 Vision Extract: ${expectedType}${expectedUnits ? ` (${expectedUnits})` : ''} | ${Math.round(imageBase64.length / 1024)}KB`)

	if (!USE_LLM) {
		console.log('❌ USE_LLM is false, returning rewrite')
		return res.status(200).json({ status: 'rewrite' })
	}

	try {
		const url = String(imageBase64).startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`

		const system = 'Return strict JSON only as per the provided JSON Schema.'
		const userText = [
			'Extract ONLY the final answer written in the dock.',
			'If you see units, include them in the "units" field.',
			'Put the main answer (number, expression, or text) in the "value" field.',
			'Extract exactly what you see - do not interpret or convert notation.',
		].join('\n')

		// Prompts configured

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body: any = {
			model: VISION_MODEL,
			text: {
				format: {
					type: 'json_schema',
					name: 'dock_extract',
					description: 'Extract text/number from the answer dock image',
					schema: {
						type: 'object',
						additionalProperties: false,
						properties: {
							value: { type: 'string' },
							units: { type: 'string' },
							confidence: { type: 'number', minimum: 0, maximum: 1 },
							abstain: { type: 'boolean' },
						},
						required: ['value', 'confidence', 'units', 'abstain'],
					},
				}
			},
			input: [
				{ role: 'system', content: [{ type: 'input_text', text: system }] },
				{ role: 'user', content: [ { type: 'input_text', text: userText }, { type: 'input_image', image_url: url, detail: 'high' } ] },
			],
		}

		console.log('🤖 Calling OpenAI Vision API...')

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const completion = await (openai as any).responses.create(body)

		console.log('✅ OpenAI Response received')

		const content = completion.output_text ?? '{}'

		let data: ExtractJSON
		try {
			data = JSON.parse(content) as ExtractJSON
		} catch (parseError) {
			console.log('❌ JSON Parse Error:', parseError)
			console.log('Raw content that failed to parse:', content)
			return res.status(200).json({ status: 'rewrite' })
		}

		const confidence = Number(data.confidence ?? 0)
		const abstain = Boolean(data.abstain)
		const value = String(data.value ?? '').trim()

		if (abstain || !confidence || confidence < VISION_CONF_THRESHOLD || !value) {
			console.log(`❌ Validation failed: value="${value}", conf=${confidence}, abstain=${abstain}`)
			return res.status(200).json({ status: 'rewrite' })
		}

		const payload = {
			value,
			units: data.units ? String(data.units).trim() : undefined,
			confidence,
		}
		console.log(`✅ Extracted: "${payload.value}" (${expectedType}, conf=${confidence})`)
		
		return res.status(200).json({ status: 'grade', payload })
	} catch (error) {
		console.log('💥 Error in vision-extract:', error)
		console.log('Error details:', JSON.stringify(error, null, 2))
		console.log('=== END VISION EXTRACT DEBUG ===\n')
		return res.status(200).json({ status: 'rewrite' })
	}
}
