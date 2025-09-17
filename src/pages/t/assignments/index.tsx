import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import RoleGuard from '@/components/RoleGuard'
import { DashboardSkeleton } from '@/components/Skeleton'
import { LoadingButton } from '@/components/Loading'
import Link from 'next/link'

type Classroom = { id: string; name: string | null; join_code: string }
type Assignment = { id: string; title: string | null; _count?: { problems: number } }

export default function TAssignments() {
	const router = useRouter()
	const { classroom: classroomParam } = router.query
	
	const [classrooms, setClassrooms] = useState<Classroom[]>([])
	const [selectedClassroom, setSelectedClassroom] = useState<string>('')
	const [currentClassroomName, setCurrentClassroomName] = useState<string>('')
	const [assignments, setAssignments] = useState<Assignment[]>([])
	const [title, setTitle] = useState('')
	const [loading, setLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	useEffect(() => {
		void loadClassrooms()
	}, [])

	useEffect(() => {
		if (selectedClassroom) {
			void loadAssignments()
		}
	}, [selectedClassroom])

	useEffect(() => {
		// Set classroom from URL parameter
		if (classroomParam && typeof classroomParam === 'string') {
			setSelectedClassroom(classroomParam)
		}
	}, [classroomParam, classrooms])

	async function loadClassrooms() {
		setError(null)
		try {
			const supabase = getSupabaseBrowser()
			const { data, error } = await supabase
				.from('classrooms')
				.select('id, name, join_code')
				.order('name')
				.limit(50)
			if (error) throw error
			setClassrooms(data ?? [])
			
			// Set selected classroom from URL or default to first
			const targetClassroom = (classroomParam && typeof classroomParam === 'string') 
				? classroomParam 
				: data?.[0]?.id
			if (targetClassroom) {
				setSelectedClassroom(targetClassroom)
				const classroom = data?.find(c => c.id === targetClassroom)
				setCurrentClassroomName(classroom?.name || 'Untitled Classroom')
			}
		} catch {
			setError('Failed to load classrooms')
		} finally {
			setInitialLoading(false)
		}
	}

	async function loadAssignments() {
		if (!selectedClassroom) return
		setError(null)
		try {
			const supabase = getSupabaseBrowser()
			const { data, error } = await supabase
				.from('assignments')
				.select(`
					id, 
					title,
					problems(count)
				`)
				.eq('classroom_id', selectedClassroom)
				.order('title')
				.limit(50)
			if (error) throw error
			setAssignments(data?.map(a => ({
				...a,
				_count: { problems: a.problems?.length || 0 }
			})) ?? [])
		} catch {
			setError('Failed to load assignments')
		}
	}

	async function createAssignment(e: React.FormEvent) {
		e.preventDefault()
		if (!selectedClassroom || !title.trim()) return
		setLoading(true)
		setError(null)
		setSuccess(null)
		try {
			const supabase = getSupabaseBrowser()
			const { data, error } = await supabase
				.from('assignments')
				.insert({ 
					classroom_id: selectedClassroom, 
					title: title.trim(), 
					ai_feedback_enabled: false 
				})
				.select('id')
				.single()
			if (error) throw error
			const assignmentTitle = title.trim()
			setTitle('')
			setSuccess(`Assignment "${assignmentTitle}" created successfully!`)
			await loadAssignments()
			// Redirect to assignment detail to add problems
			if (data?.id) {
				setTimeout(() => router.push(`/t/assignments/${data.id}`), 1500)
			}
		} catch {
			setError('Failed to create assignment')
		} finally {
			setLoading(false)
		}
	}

	async function deleteAssignment(assignmentId: string, assignmentTitle: string) {
		if (!confirm(`Are you sure you want to delete "${assignmentTitle}"? This will also delete all problems and submissions and cannot be undone.`)) {
			return
		}
		setDeleteLoading(assignmentId)
		setError(null)
		setSuccess(null)
		try {
			const supabase = getSupabaseBrowser()
			console.log('Deleting assignment:', assignmentId)
			
			const { data, error } = await supabase
				.from('assignments')
				.delete()
				.eq('id', assignmentId)
				.select()
			
			console.log('Delete result:', { data, error })
			
			if (error) {
				console.error('Delete error:', error)
				throw error
			}
			
			if (!data || data.length === 0) {
				throw new Error('Assignment not found or not authorized to delete')
			}
			
			// Immediately remove from UI for instant feedback
			console.log('Current assignments before filter:', assignments.length)
			console.log('Removing assignment ID:', assignmentId)
			
			setAssignments(prev => {
				const filtered = prev.filter(a => a.id !== assignmentId)
				console.log('Assignments after filter:', filtered.length, 'removed:', prev.length - filtered.length)
				return filtered
			})
			
			setSuccess(`Assignment "${assignmentTitle}" deleted successfully`)
			console.log('Reloading assignments after delete...')
			await loadAssignments()
			console.log('Assignments reloaded, new count:', assignments.length)
		} catch (err) {
			console.error('Delete assignment error:', err)
			setError(`Failed to delete assignment: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setDeleteLoading(null)
		}
	}

	function handleClassroomChange(classroomId: string) {
		setSelectedClassroom(classroomId)
		const classroom = classrooms.find(c => c.id === classroomId)
		setCurrentClassroomName(classroom?.name || 'Untitled Classroom')
		// Update URL
		router.push(`/t/assignments?classroom=${classroomId}`, undefined, { shallow: true })
	}

	if (initialLoading) {
		return (
			<RoleGuard requiredRole="teacher">
				<DashboardSkeleton />
			</RoleGuard>
		)
	}

	return (
		<RoleGuard requiredRole="teacher">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="mb-6">
					<nav className="flex items-center gap-2 text-sm text-slate-600 mb-2">
						<Link href="/t" className="hover:text-slate-900">Classrooms</Link>
						<span>/</span>
						<span className="text-slate-900 font-medium">{currentClassroomName}</span>
					</nav>
					<h1 className="text-3xl font-bold text-slate-900 mb-2">Assignments</h1>
					<p className="text-slate-600">Create and manage assignments for your students.</p>
				</div>

				{/* Classroom selector */}
				{classrooms.length > 1 && (
					<div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
						<label className="block text-sm font-medium text-slate-700 mb-2">Classroom</label>
						<select 
							value={selectedClassroom} 
							onChange={(e) => handleClassroomChange(e.target.value)}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						>
							{classrooms.map(c => (
								<option key={c.id} value={c.id}>
									{c.name || 'Untitled Classroom'} ({c.join_code})
								</option>
							))}
						</select>
					</div>
				)}

				{/* Create assignment */}
				<div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
					<h2 className="text-lg font-semibold text-slate-900 mb-3">Create New Assignment</h2>
					<form onSubmit={createAssignment} className="flex gap-3">
						<input 
							value={title} 
							onChange={(e) => setTitle(e.target.value)} 
							placeholder="e.g., Quadratic Equations - Chapter 5" 
							className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
							required
							disabled={loading}
						/>
						<LoadingButton
							type="submit"
							loading={loading}
							disabled={!selectedClassroom || !title.trim()}
							className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
						>
							{loading ? 'Creating…' : 'Create & Add Problems'}
						</LoadingButton>
					</form>
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

				{/* Assignments list */}
				{assignments.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-slate-400 mb-4">
							<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-slate-900 mb-2">No assignments yet</h3>
						<p className="text-slate-600">Create your first assignment to get started.</p>
					</div>
				) : (
					<div className="grid gap-4">
						{assignments.map(assignment => (
							<div key={assignment.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-sm transition-shadow">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<h3 className="text-lg font-semibold text-slate-900 mb-1">
											{assignment.title || 'Untitled Assignment'}
										</h3>
										<div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
											<span>{assignment._count?.problems || 0} problems</span>
										</div>
										<div className="flex items-center gap-3">
											<Link 
												href={`/t/assignments/${assignment.id}`}
												className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
												Edit Problems
											</Link>
											{assignment._count && assignment._count.problems > 0 && (
												<Link 
													href={`/t/reports/${assignment.id}`}
													className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
												>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
													</svg>
													View Reports
												</Link>
											)}
											<button 
												onClick={() => deleteAssignment(assignment.id, assignment.title || 'Untitled Assignment')}
												disabled={deleteLoading === assignment.id}
												className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
											>
												{deleteLoading === assignment.id ? (
													<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
												) : (
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												)}
												{deleteLoading === assignment.id ? 'Deleting…' : 'Delete'}
											</button>
										</div>
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
