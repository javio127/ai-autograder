import { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

type AccessAssignmentRequest = {
	assignmentId: string
}

type AccessAssignmentResponse = {
	success: boolean
	message: string
	assignmentId?: string
	problemId?: string
	classroomId?: string
	enrolled?: boolean
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<AccessAssignmentResponse>
) {
	if (req.method !== 'POST') {
		return res.status(405).json({ success: false, message: 'Method not allowed' })
	}

	try {
		const { assignmentId } = req.body as AccessAssignmentRequest

		if (!assignmentId) {
			return res.status(400).json({ success: false, message: 'Assignment ID is required' })
		}

		// Get the current user from the Authorization header (like join-classroom API)
		const authHeader = req.headers.authorization
		if (!authHeader?.startsWith('Bearer ')) {
			return res.status(401).json({ success: false, message: 'Not authenticated' })
		}
		
		const token = authHeader.split(' ')[1]
		const adminSupabase = getSupabaseAdmin()
		const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
		
		if (userError || !user) {
			return res.status(401).json({ success: false, message: 'Invalid authentication' })
		}

		// Get assignment and classroom info using the admin client
		const { data: assignmentData, error: assignmentError } = await adminSupabase
			.from('assignments')
			.select(`
				id,
				classroom_id,
				title,
				classrooms!inner(
					id,
					name,
					teacher_id
				),
				problems(id, order_index)
			`)
			.eq('id', assignmentId)
			.maybeSingle()

		if (assignmentError || !assignmentData) {
			return res.status(404).json({ success: false, message: 'Assignment not found' })
		}

		const classroomId = assignmentData.classroom_id
		const problems = assignmentData.problems || []

		if (problems.length === 0) {
			return res.status(400).json({ success: false, message: 'Assignment has no problems' })
		}

		// Sort problems by order_index and get the first one
		const firstProblem = problems.sort((a, b) => a.order_index - b.order_index)[0]

		// Check if student is already enrolled in this classroom
		const { data: enrollmentData } = await adminSupabase
			.from('enrollments')
			.select('id')
			.eq('student_id', user.id)
			.eq('classroom_id', classroomId)
			.maybeSingle()

		let enrolled = !!enrollmentData

		// If not enrolled, auto-enroll the student
		if (!enrolled) {
			const { error: enrollError } = await adminSupabase
				.from('enrollments')
				.insert({
					student_id: user.id,
					classroom_id: classroomId
				})

			if (enrollError) {
				// Check if it's a duplicate key error (student already enrolled)
				if (enrollError.code === '23505') {
					enrolled = true
				} else {
					console.error('Failed to enroll student:', enrollError)
					return res.status(500).json({ 
						success: false, 
						message: 'Failed to enroll in classroom' 
					})
				}
			} else {
				enrolled = true
			}
		}

		return res.status(200).json({
			success: true,
			message: enrolled ? 'Access granted to assignment' : 'Already enrolled',
			assignmentId: assignmentData.id,
			problemId: firstProblem.id,
			classroomId,
			enrolled
		})

	} catch (error) {
		console.error('Access assignment error:', error)
		return res.status(500).json({
			success: false,
			message: 'Internal server error'
		})
	}
}
