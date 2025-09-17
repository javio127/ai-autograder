import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import RoleGuard from '@/components/RoleGuard'
import TeacherReport from '@/components/TeacherReport'
import { LoadingScreen } from '@/components/Loading'
import Link from 'next/link'

type Submission = {
	id: string
	student_id: string
	problem_id: string
	result: string | null
	created_at: string
	users: {
		id: string
		email: string | null
	}
	problems: {
		id: string
		description: string
		order_index: number
	}
}

type Assignment = {
	id: string
	title: string | null
	classroom: {
		id: string
		name: string | null
	}
}

export default function Report() {
	const router = useRouter()
	const { assignmentId } = router.query
	const [submissions, setSubmissions] = useState<Submission[]>([])
	const [assignment, setAssignment] = useState<Assignment | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		async function loadReport() {
			if (!assignmentId || typeof assignmentId !== 'string') return

			try {
				setLoading(true)
				const supabase = getSupabaseBrowser()

				// Load assignment info
				const { data: assignmentData, error: assignmentError } = await supabase
					.from('assignments')
					.select(`
						id,
						title,
						classrooms!inner(
							id,
							name,
							teacher_id
						)
					`)
					.eq('id', assignmentId)
					.maybeSingle()

				if (assignmentError) throw assignmentError
				if (!assignmentData) throw new Error('Assignment not found')

				setAssignment({
					id: assignmentData.id,
					title: assignmentData.title,
					classroom: Array.isArray(assignmentData.classrooms) 
						? assignmentData.classrooms[0] 
						: assignmentData.classrooms
				})

				// Load submissions for this assignment - simplified query
				// First get all problems for this assignment
				const { data: assignmentProblems, error: problemsError } = await supabase
					.from('problems')
					.select('id, order_index, description')
					.eq('assignment_id', assignmentId)

				if (problemsError) throw problemsError

				const problemIds = assignmentProblems?.map(p => p.id) || []

				// Then get submissions for those problems
				const { data: submissionsData, error: submissionsError } = await supabase
					.from('submissions')
					.select(`
						id,
						student_id,
						problem_id,
						result,
						created_at
					`)
					.in('problem_id', problemIds)
					.order('created_at', { ascending: false })

				if (submissionsError) throw submissionsError

				// Get user data for the students who submitted
				const studentIds = [...new Set(submissionsData?.map(s => s.student_id) || [])]
				const { data: usersData, error: usersError } = await supabase
					.from('users')
					.select('id, email')
					.in('id', studentIds)

				if (usersError) {
					console.error('Users query error:', usersError)
				}

				if (submissionsError) throw submissionsError

				// Create lookup maps
				const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])
				const problemsMap = new Map(assignmentProblems?.map(p => [p.id, p]) || [])

				// Process submissions to get the latest for each student-problem pair
				const latestSubmissions = new Map<string, Submission>()
				
				submissionsData?.forEach((sub) => {
					const key = `${sub.student_id}-${sub.problem_id}`
					const user = usersMap.get(sub.student_id)
					const problem = problemsMap.get(sub.problem_id)
					
					if (problem) {
						const submission: Submission = {
							id: sub.id,
							student_id: sub.student_id,
							problem_id: sub.problem_id,
							result: sub.result,
							created_at: sub.created_at,
							users: user || { id: sub.student_id, email: `user-${sub.student_id.slice(0, 8)}@example.com` },
							problems: problem
						}
						
						// Keep only the latest submission for each student-problem pair
						if (!latestSubmissions.has(key) || 
							new Date(submission.created_at) > new Date(latestSubmissions.get(key)!.created_at)) {
							latestSubmissions.set(key, submission)
						}
					}
				})

				setSubmissions(Array.from(latestSubmissions.values()))

			} catch (err) {
				console.error('Failed to load report:', err)
				setError(err instanceof Error ? err.message : 'Failed to load report')
			} finally {
				setLoading(false)
			}
		}

		loadReport()
	}, [assignmentId])

	if (loading) {
		return (
			<RoleGuard requiredRole="teacher">
				<LoadingScreen message="Loading report..." />
			</RoleGuard>
		)
	}

	if (error) {
		return (
			<RoleGuard requiredRole="teacher">
				<div className="min-h-screen bg-slate-50 py-8">
					<div className="max-w-4xl mx-auto px-4">
						<div className="bg-red-50 border border-red-200 rounded-lg p-6">
							<h1 className="text-lg font-semibold text-red-900 mb-2">Error Loading Report</h1>
							<p className="text-red-700">{error}</p>
							<Link href="/t" className="mt-4 inline-block text-red-600 hover:text-red-700 underline">
								← Back to Dashboard
							</Link>
						</div>
					</div>
				</div>
			</RoleGuard>
		)
	}

	if (!assignment) {
		return (
			<RoleGuard requiredRole="teacher">
				<div className="min-h-screen bg-slate-50 py-8">
					<div className="max-w-4xl mx-auto px-4">
						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
							<h1 className="text-lg font-semibold text-yellow-900 mb-2">Assignment Not Found</h1>
							<p className="text-yellow-700">The requested assignment could not be found.</p>
							<Link href="/t" className="mt-4 inline-block text-yellow-600 hover:text-yellow-700 underline">
								← Back to Dashboard
							</Link>
						</div>
					</div>
				</div>
			</RoleGuard>
		)
	}

	// Convert submissions to the format expected by TeacherReport
	// Sort by problem order_index first, then by student email
	const reportRows = submissions
		.sort((a, b) => {
			// First sort by problem order
			const orderDiff = a.problems.order_index - b.problems.order_index
			if (orderDiff !== 0) return orderDiff
			
			// Then sort by student email
			const emailA = a.users.email || ''
			const emailB = b.users.email || ''
			return emailA.localeCompare(emailB)
		})
		.map(sub => ({
			student: sub.users.email?.split('@')[0] || `Student ${sub.student_id.slice(0, 8)}`,
			problem: `Problem ${sub.problems.order_index + 1}`,
			result: sub.result === 'PASS' ? 'PASS' as const : 
					sub.result === 'FAIL' ? 'FAIL' as const : 
					'REVIEW' as const
		}))

	return (
		<RoleGuard requiredRole="teacher">
			<div className="min-h-screen bg-slate-50 py-8">
				<div className="max-w-4xl mx-auto px-4">
					{/* Header */}
					<div className="mb-8">
						<div className="flex items-center gap-4 mb-4">
							<Link 
								href="/t" 
								className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
								</svg>
								Dashboard
							</Link>
							<span className="text-slate-400">/</span>
							<span className="text-slate-600">Reports</span>
						</div>
						<h1 className="text-3xl font-bold text-slate-900 mb-2">
							{assignment.title || 'Untitled Assignment'}
						</h1>
						<p className="text-slate-600">
							{assignment.classroom.name || 'Untitled Classroom'} • {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
						</p>
					</div>

					{/* Report */}
					<div className="bg-white border border-slate-200 rounded-xl p-6">
						<h2 className="text-lg font-semibold text-slate-900 mb-4">Student Submissions</h2>
						
						{reportRows.length === 0 ? (
							<div className="text-center py-12">
								<div className="text-slate-400 mb-4">
									<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								</div>
								<h3 className="text-lg font-medium text-slate-900 mb-2">No submissions yet</h3>
								<p className="text-slate-600">Students haven&apos;t started working on this assignment.</p>
							</div>
						) : (
							<TeacherReport rows={reportRows} />
						)}
					</div>
				</div>
			</div>
		</RoleGuard>
	)
}
