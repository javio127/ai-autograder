import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

type JoinClassroomRequest = {
	joinCode: string
}

type JoinClassroomResponse = {
	success: boolean
	message: string
	classroom?: {
		id: string
		name: string | null
	}
}

export default async function handler(
	req: NextApiRequest, 
	res: NextApiResponse<JoinClassroomResponse>
) {
	if (req.method !== 'POST') {
		return res.status(405).json({ success: false, message: 'Method not allowed' })
	}

	const { joinCode } = req.body as JoinClassroomRequest
	if (!joinCode?.trim()) {
		return res.status(400).json({ success: false, message: 'Join code is required' })
	}

	try {
		const admin = getSupabaseAdmin()
		
		// Get the current user from the request
		const authHeader = req.headers.authorization
		if (!authHeader?.startsWith('Bearer ')) {
			return res.status(401).json({ success: false, message: 'Not authenticated' })
		}
		
		const token = authHeader.split(' ')[1]
		const { data: { user }, error: userError } = await admin.auth.getUser(token)
		if (userError || !user) {
			return res.status(401).json({ success: false, message: 'Invalid authentication' })
		}

		// Find classroom by join code (admin can bypass RLS)
		const { data: classroom, error: classroomError } = await admin
			.from('classrooms')
			.select('id, name, join_code')
			.eq('join_code', joinCode.trim().toUpperCase())
			.maybeSingle()

		if (classroomError) {
			console.error('Classroom lookup error:', classroomError)
			return res.status(500).json({ success: false, message: 'Database error' })
		}

		if (!classroom) {
			return res.status(404).json({ success: false, message: 'Invalid join code' })
		}

		// Check if already enrolled
		const { data: existingEnrollment } = await admin
			.from('enrollments')
			.select('classroom_id')
			.eq('classroom_id', classroom.id)
			.eq('student_id', user.id)
			.maybeSingle()

		if (existingEnrollment) {
			return res.status(200).json({ 
				success: true, 
				message: `You're already in "${classroom.name || 'Untitled Classroom'}"`,
				classroom: { id: classroom.id, name: classroom.name }
			})
		}

		// Enroll student
		const { error: enrollError } = await admin
			.from('enrollments')
			.insert({
				classroom_id: classroom.id,
				student_id: user.id
			})

		if (enrollError) {
			console.error('Enrollment error:', enrollError)
			return res.status(500).json({ success: false, message: 'Failed to join classroom' })
		}

		return res.status(200).json({ 
			success: true, 
			message: `Successfully joined "${classroom.name || 'Untitled Classroom'}"!`,
			classroom: { id: classroom.id, name: classroom.name }
		})

	} catch (error) {
		console.error('Join classroom error:', error)
		return res.status(500).json({ success: false, message: 'Server error' })
	}
}
