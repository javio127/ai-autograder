import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import RoleGuard from '@/components/RoleGuard'
import { DashboardSkeleton } from '@/components/Skeleton'
import Link from 'next/link'

type Assignment = {
	id: string
	title: string | null
	problems: Array<{ id: string }>
}

type Classroom = {
	id: string
	name: string | null
	join_code: string
	assignments: Assignment[]
}

export default function StudentClassroom() {
	const router = useRouter()
	const { id } = router.query
	const [classroom, setClassroom] = useState<Classroom | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		async function loadClassroom() {
			if (!id || typeof id !== 'string') return
			
			setLoading(true)
			try {
				const supabase = getSupabaseBrowser()
				const { data: user } = await supabase.auth.getUser()
				if (!user.user) throw new Error('Not authenticated')

				// Get classroom details and assignments for enrolled student
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
					.eq('classroom_id', id)
					.maybeSingle()

				if (error) throw error
				if (!data) throw new Error('Classroom not found or access denied')

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const classroomData = Array.isArray(data.classrooms) ? data.classrooms[0] : data.classrooms as any
				setClassroom({
					id: classroomData.id,
					name: classroomData.name,
					join_code: classroomData.join_code,
					assignments: classroomData.assignments || []
				})
			} catch (err) {
				console.error('Failed to load classroom:', err)
				setError(err instanceof Error ? err.message : 'Failed to load classroom')
			} finally {
				setLoading(false)
			}
		}

		loadClassroom()
	}, [id])

	if (loading) {
		return (
			<RoleGuard requiredRole="student">
				<DashboardSkeleton />
			</RoleGuard>
		)
	}

	if (error || !classroom) {
		return (
			<RoleGuard requiredRole="student">
				<div className="max-w-4xl mx-auto p-6">
					<div className="text-center">
						<h1 className="text-xl font-semibold text-slate-900 mb-2">Classroom Not Found</h1>
						<p className="text-slate-600 mb-4">{error || 'This classroom may not exist or you may not have access to it.'}</p>
						<Link href="/s" className="text-emerald-600 hover:text-emerald-700">← Back to Dashboard</Link>
					</div>
				</div>
			</RoleGuard>
		)
	}

	return (
		<RoleGuard requiredRole="student">
			<div className="max-w-4xl mx-auto p-6">
				{/* Header */}
				<div className="mb-6">
					<nav className="flex items-center gap-2 text-sm text-slate-600 mb-2">
						<Link href="/s" className="hover:text-slate-900">Dashboard</Link>
						<span>/</span>
						<span>{classroom.name || 'Untitled Classroom'}</span>
					</nav>
					<h1 className="text-3xl font-bold text-slate-900 mb-2">{classroom.name || 'Untitled Classroom'}</h1>
					<div className="flex items-center gap-4 text-sm text-slate-600">
						<span>Join code: <span className="font-mono font-semibold text-slate-900">{classroom.join_code}</span></span>
						<span>{classroom.assignments.length} assignments</span>
					</div>
				</div>

				{/* Assignments */}
				{classroom.assignments.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-slate-400 mb-4">
							<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-slate-900 mb-1">No assignments yet</h3>
						<p className="text-slate-600">Your teacher hasn&apos;t created any assignments for this classroom yet.</p>
					</div>
				) : (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold text-slate-900">Assignments</h2>
						{classroom.assignments.map((assignment) => (
							<div key={assignment.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<h3 className="text-lg font-semibold text-slate-900 mb-2">
											{assignment.title || 'Untitled Assignment'}
										</h3>
										<div className="text-sm text-slate-600 mb-4">
											{assignment.problems.length} problem{assignment.problems.length !== 1 ? 's' : ''}
										</div>
									</div>
									<div className="flex items-center gap-3">
										{assignment.problems.length > 0 ? (
											<Link 
												href={`/s/assignments/${assignment.id}/${assignment.problems[0].id}`}
												className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
												</svg>
												Start Assignment
											</Link>
										) : (
											<div className="text-sm text-slate-500 italic">No problems yet</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</RoleGuard>
	)
}
