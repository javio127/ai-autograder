import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import RoleGuard from '@/components/RoleGuard'
import { DashboardSkeleton } from '@/components/Skeleton'
import { LoadingButton } from '@/components/Loading'
import Link from 'next/link'

type Classroom = {
	id: string
	name: string | null
	join_code: string
	assignments: Array<{
		id: string
		title: string | null
		problems: Array<{ id: string }>
	}>
}

export default function SDashboard() {
	const [joinCode, setJoinCode] = useState('')
	const [assignmentLink, setAssignmentLink] = useState('')
	const [classrooms, setClassrooms] = useState<Classroom[]>([])
	const [loading, setLoading] = useState(false)
	const [assignmentLoading, setAssignmentLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [assignmentError, setAssignmentError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	async function joinClassroom() {
		if (!joinCode.trim()) {
			setError('Please enter a join code')
			return
		}

		setLoading(true)
		setError(null)
		setSuccess(null)

		try {
			const supabase = getSupabaseBrowser()
			const { data: { session } } = await supabase.auth.getSession()
			if (!session?.access_token) throw new Error('Not authenticated')

			// Use the new API endpoint that bypasses RLS issues
			const response = await fetch('/api/join-classroom', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ joinCode: joinCode.trim() })
			})

			const result = await response.json()
			
			if (!result.success) {
				throw new Error(result.message)
			}

			setSuccess(result.message)
			setJoinCode('')
			await loadClassrooms()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to join classroom')
		} finally {
			setLoading(false)
		}
	}

	async function goToAssignment() {
		if (!assignmentLink.trim()) {
			setAssignmentError('Please enter an assignment link or code')
			return
		}

		setAssignmentLoading(true)
		setAssignmentError(null)

		try {
			const input = assignmentLink.trim()
			let assignmentId: string | null = null
			let problemId: string | null = null
			
			// Check if it's a full URL
			if (input.includes('/s/assignments/')) {
				// Extract assignment and problem IDs from URL
				const match = input.match(/\/s\/assignments\/([^\/]+)\/([^\/\?]+)/)
				if (match) {
					assignmentId = match[1]
					problemId = match[2]
				}
			}
			// Check if it's just an assignment ID (like "cm123abc")
			else if (input.match(/^[a-zA-Z0-9]{8,}$/)) {
				assignmentId = input
				// problemId will be determined by the API
			}
			
			if (!assignmentId) {
				throw new Error('Invalid assignment link or code format')
			}

			// Use the access-assignment API to handle enrollment and get problem ID
			const supabase = getSupabaseBrowser()
			const { data: { session } } = await supabase.auth.getSession()
			if (!session?.access_token) throw new Error('Not authenticated')

			const response = await fetch('/api/access-assignment', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ assignmentId })
			})

			const result = await response.json()
			
			if (!result.success) {
				throw new Error(result.message)
			}

			// Use the problem ID from the API response, or fall back to the one from URL
			const finalProblemId = result.problemId || problemId
			
			if (!finalProblemId) {
				throw new Error('No problems found in assignment')
			}

			// Navigate to the assignment
			window.location.href = `/s/assignments/${assignmentId}/${finalProblemId}`
			
		} catch (err) {
			setAssignmentError(err instanceof Error ? err.message : 'Failed to access assignment')
		} finally {
			setAssignmentLoading(false)
		}
	}

	async function loadClassrooms() {
		try {
			const supabase = getSupabaseBrowser()
			const { data: user } = await supabase.auth.getUser()
			if (!user.user) return

			const { data, error } = await supabase
				.from('enrollments')
				.select(`
					classroom_id,
					classrooms!inner(
						id,
						name,
						join_code,
						assignments(
							id,
							title,
							problems(id)
						)
					)
				`)
				.eq('student_id', user.user.id)

			if (error) throw error

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const classroomsData = data?.map((enrollment: any) => {
				const classroom = Array.isArray(enrollment.classrooms) ? enrollment.classrooms[0] : enrollment.classrooms
				return {
					id: classroom.id,
					name: classroom.name,
					join_code: classroom.join_code,
					assignments: classroom.assignments || []
				}
			}) || []

			setClassrooms(classroomsData)
		} catch (err) {
			console.error('Failed to load classrooms:', err)
		} finally {
			setInitialLoading(false)
		}
	}

	useEffect(() => {
		void loadClassrooms()
	}, [])

	if (initialLoading) {
		return (
			<RoleGuard requiredRole="student">
				<DashboardSkeleton />
			</RoleGuard>
		)
	}

	return (
		<RoleGuard requiredRole="student">
			<div className="min-h-screen bg-slate-50 py-8">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-slate-900 mb-2">My Math Assignments</h1>
						<p className="text-slate-600">Join a classroom or work on your assignments</p>
					</div>

					{/* Join Options */}
					<div className="mb-8 grid gap-6 md:grid-cols-2">
						{/* Join Classroom */}
						<div className="p-6 bg-white border border-slate-200 rounded-xl">
							<h2 className="text-lg font-semibold text-slate-900 mb-3">Join a Classroom</h2>
							<p className="text-sm text-slate-600 mb-4">Enter the join code your teacher gave you</p>
							
							<div className="flex items-center gap-3">
								<input
									type="text"
									value={joinCode}
									onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
									placeholder="Enter join code (e.g., ABC123)"
									className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
									maxLength={6}
								/>
								<LoadingButton
									onClick={joinClassroom}
									loading={loading}
									className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
								>
									{loading ? 'Joining...' : 'Join'}
								</LoadingButton>
							</div>

							{error && (
								<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
									<div className="text-sm text-red-800">{error}</div>
								</div>
							)}
							{success && (
								<div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
									<div className="text-sm text-emerald-800">{success}</div>
								</div>
							)}
						</div>

						{/* Go to Assignment */}
						<div className="p-6 bg-white border border-slate-200 rounded-xl">
							<h2 className="text-lg font-semibold text-slate-900 mb-3">Go to Assignment</h2>
							<p className="text-sm text-slate-600 mb-4">Enter an assignment link or code</p>
							
							<div className="flex items-center gap-3">
								<input
									type="text"
									value={assignmentLink}
									onChange={(e) => setAssignmentLink(e.target.value.trim())}
									placeholder="Paste assignment link or enter code"
									className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<LoadingButton
									onClick={goToAssignment}
									loading={assignmentLoading}
									className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								>
									{assignmentLoading ? 'Going...' : 'Go'}
								</LoadingButton>
							</div>

							{assignmentError && (
								<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
									<div className="text-sm text-red-800">{assignmentError}</div>
								</div>
							)}
						</div>
					</div>

					{/* My Classrooms */}
					{classrooms.length > 0 ? (
						<div className="space-y-6">
							<h2 className="text-xl font-semibold text-slate-900">My Classrooms</h2>
							{classrooms.map(classroom => (
								<div key={classroom.id} className="bg-white border border-slate-200 rounded-xl p-6">
									<div className="flex items-start justify-between mb-4">
										<div className="flex-1">
											<h3 className="text-lg font-semibold text-slate-900 mb-1">
												{classroom.name || 'Untitled Classroom'}
											</h3>
											<div className="flex items-center gap-4 text-sm text-slate-600">
												<span>Join code: <span className="font-mono font-semibold text-slate-900">{classroom.join_code}</span></span>
												<span>{classroom.assignments.length} assignment{classroom.assignments.length !== 1 ? 's' : ''}</span>
											</div>
										</div>
										<Link
											href={`/s/classrooms/${classroom.id}`}
											className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											View Assignments
										</Link>
									</div>

									{classroom.assignments.length > 0 && (
										<div className="pt-4 border-t border-slate-200">
											<p className="text-xs font-medium text-slate-600 mb-3">Recent assignments:</p>
											<div className="space-y-2">
												{classroom.assignments.slice(0, 2).map(assignment => (
													<div key={assignment.id} className="flex items-center justify-between text-sm">
														<span className="text-slate-700">
															{assignment.title || 'Untitled Assignment'} ({assignment.problems.length} problem{assignment.problems.length !== 1 ? 's' : ''})
														</span>
														{assignment.problems.length > 0 && (
															<Link
																href={`/s/assignments/${assignment.id}/${assignment.problems[0].id}`}
																className="text-emerald-600 hover:text-emerald-700 font-medium"
															>
																Start →
															</Link>
														)}
													</div>
												))}
												{classroom.assignments.length > 2 && (
													<div className="text-xs text-slate-500">
														+{classroom.assignments.length - 2} more assignments
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-12">
							<div className="text-slate-400 mb-4">
								<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
								</svg>
							</div>
							<h3 className="text-lg font-medium text-slate-900 mb-2">No classrooms yet</h3>
							<p className="text-slate-600">Enter a join code above to get started with your first classroom!</p>
						</div>
					)}
				</div>
			</div>
		</RoleGuard>
	)
}
