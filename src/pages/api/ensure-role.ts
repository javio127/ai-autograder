import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).end()
	const { userId, email, role } = req.body as { userId: string; email?: string; role: 'teacher' | 'student' }
	if (!userId || !role) return res.status(400).json({ error: 'Missing fields' })
	const admin = getSupabaseAdmin()
	await admin.from('users').upsert({ id: userId, role, email }, { onConflict: 'id' })
	return res.status(200).json({ ok: true })
}
