import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import RoleGuard from '@/components/RoleGuard'
import { TeacherDashboardSkeleton } from '@/components/Skeleton'
import { LoadingButton } from '@/components/Loading'
import Link from 'next/link'

function generateJoinCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let code = ''
	for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
	return code
}

export default function TDashboard() {
	const [classrooms, setClassrooms] = useState<{ id: string; join_code: string; name: string | null; _count?: { assignments: number } }[]>([])
	const [name, setName] = useState('')
	const [loading, setLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [copySuccess, setCopySuccess] = useState<string | null>(null)

	useEffect(() => {
		void load()
	}, [])

	async function load() {
		setError(null)
		try {
			const supabase = getSupabaseBrowser()
			
			// Check if user is authenticated
			const { data: { user }, error: authError } = await supabase.auth.getUser()
			if (authError) {
				console.error('Auth error:', authError)
				throw new Error('Authentication error')
			}
			if (!user) {
				throw new Error('User not authenticated')
			}

			console.log('Loading classrooms for user:', user.id)
			
			const { data, error } = await supabase
				.from('classrooms')
				.select(`
					id, 
					join_code, 
					name,
					teacher_id,
					assignments(count)
				`)
				.order('name')
				.limit(50)
			
			console.log('Classrooms query result:', { data, error })
			
			if (error) {
				console.error('Database error:', error)
				throw error
			}
			
			setClassrooms(data?.map(c => ({
				...c,
				_count: { assignments: c.assignments?.length || 0 }
			})) ?? [])
			
			console.log('Classrooms loaded:', data?.length || 0)
		} catch (err) {
			console.error('Load classrooms error:', err)
			setError(`Failed to load classrooms: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setInitialLoading(false)
		}
	}

	async function createClassroom(e: React.FormEvent) {
		e.preventDefault()
		if (!name.trim()) return
		setLoading(true)
		setError(null)
		setSuccess(null)
		try {
			const supabase = getSupabaseBrowser()
			const join_code = generateJoinCode()
			const { data: u } = await supabase.auth.getUser()
			const { error } = await supabase.from('classrooms').insert({ 
				join_code, 
				name: name.trim(), 
				teacher_id: u.user?.id 
			})
			if (error) throw error
			setName('')
			setSuccess(`Classroom "${name.trim()}" created successfully!`)
			await load()
		} catch {
			setError('Failed to create classroom')
		} finally {
			setLoading(false)
		}
	}

	async function deleteClassroom(classroomId: string, classroomName: string) {
		console.log('Delete button clicked for:', classroomId, classroomName)
		
		if (!confirm(`Are you sure you want to delete "${classroomName}"? This will also delete all assignments and cannot be undone.`)) {
			console.log('Delete cancelled by user')
			return
		}
		
		console.log('Delete confirmed, proceeding...')
		setDeleteLoading(classroomId)
		setError(null)
		setSuccess(null)
		try {
			const supabase = getSupabaseBrowser()
			console.log('Attempting to delete classroom:', classroomId)
			
			const { data, error } = await supabase
				.from('classrooms')
				.delete()
				.eq('id', classroomId)
				.select()
			
			console.log('Delete classroom result:', { data, error })
			
			if (error) {
				console.error('Delete classroom error:', error)
				throw error
			}
			
			// If no error occurred, the delete was successful
			// Even if data is empty, it means the row was deleted or didn't exist
			console.log('Delete successful, data returned:', data)
			
			// Immediately remove from UI for instant feedback
			console.log('Removing classroom from UI:', classroomId)
			setClassrooms(prev => {
				const filtered = prev.filter(c => c.id !== classroomId)
				console.log('Classrooms before:', prev.length, 'after:', filtered.length)
				return filtered
			})
			
			setSuccess(`Classroom "${classroomName}" deleted successfully`)
		} catch (err) {
			console.error('Failed to delete classroom:', err)
			setError(`Failed to delete classroom: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setDeleteLoading(null)
		}
	}

	async function copyJoinCode(joinCode: string) {
		try {
			await navigator.clipboard.writeText(joinCode)
			setCopySuccess(joinCode)
			setTimeout(() => setCopySuccess(null), 2000)
		} catch {
			setError('Failed to copy code')
		}
	}

	if (initialLoading) {
		return (
			<RoleGuard requiredRole="teacher">
				<TeacherDashboardSkeleton />
			</RoleGuard>
		)
	}

	return (
		<RoleGuard requiredRole="teacher">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-900 mb-2">Your Classrooms</h1>
					<p className="text-slate-600">Create and manage your math classrooms. Students join using class codes.</p>
				</div>

				{/* Create new classroom */}
				<div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
					<h2 className="text-lg font-semibold text-slate-900 mb-3">Create New Classroom</h2>
					<form onSubmit={createClassroom} className="flex gap-3">
						<input 
							value={name} 
							onChange={(e) => setName(e.target.value)} 
							placeholder="e.g., Algebra 1 - Period 3" 
							className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
							required
							disabled={loading}
						/>
						<LoadingButton
							type="submit"
							loading={loading}
							disabled={!name.trim()}
							className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
						>
							{loading ? 'Creating…' : 'Create Classroom'}
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

				{/* Classrooms list */}
				{error && !classrooms.length ? (
					<div className="text-center py-12">
						<div className="text-red-400 mb-4">
							<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Classrooms</h3>
						<p className="text-slate-600 mb-4">{error}</p>
						<button 
							onClick={() => window.location.reload()} 
							className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
						>
							Refresh Page
						</button>
					</div>
				) : classrooms.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-slate-400 mb-4">
							<svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-slate-900 mb-2">No classrooms yet</h3>
						<p className="text-slate-600 mb-4">Create your first classroom to get started with Goblins Auto-Grader.</p>
					</div>
				) : (
					<div className="grid gap-4">
						{classrooms.map(classroom => (
							<div key={classroom.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-sm transition-shadow">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<h3 className="text-lg font-semibold text-slate-900 mb-1">
											{classroom.name || 'Untitled Classroom'}
										</h3>
										<div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
											<span>Join code: <span className="font-mono font-semibold text-slate-900">{classroom.join_code}</span></span>
											<span>{classroom._count?.assignments || 0} assignments</span>
										</div>
										<div className="flex items-center gap-3">
											<Link 
												href={`/t/assignments?classroom=${classroom.id}`}
												className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
												</svg>
												Create Assignment
											</Link>
											<Link 
												href={`/t/assignments?classroom=${classroom.id}`}
												className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
											>
												View Assignments
											</Link>
											<button 
												onClick={() => copyJoinCode(classroom.join_code)}
												className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
												{copySuccess === classroom.join_code ? 'Copied!' : 'Copy Code'}
											</button>
											<button 
												onClick={() => {
													console.log('Button clicked!', classroom.id, classroom.name)
													deleteClassroom(classroom.id, classroom.name || 'Untitled Classroom')
												}}
												disabled={deleteLoading === classroom.id}
												className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
											>
												{deleteLoading === classroom.id ? (
													<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
												) : (
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												)}
												{deleteLoading === classroom.id ? 'Deleting…' : 'Delete'}
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
