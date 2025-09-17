import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import { getBaseUrl } from '@/lib/getBaseUrl'
import RoleGuard from '@/components/RoleGuard'
import { AssignmentDetailSkeleton } from '@/components/Skeleton'
import { LoadingButton } from '@/components/Loading'
import Link from 'next/link'

function inferTypeAndCanonical(input: string, tolerance?: number, units?: string, synonyms?: string[]) {
	const t = input.trim()
	if (/^[A-D]$/i.test(t)) return { type: 'mc' as const, canonical: t.toUpperCase() }
	
	// Simple numbers
	if (/^[-+]?\d+\/\d+$/.test(t) || /^[-+]?((\d+\.?\d*)|(\d*\.?\d+))(e[-+]?\d+)?$/.test(t)) {
		const canonical: { num: string; units?: string; tolerance?: number } = { num: t }
		if (units) canonical.units = units
		if (tolerance !== undefined) canonical.tolerance = tolerance
		return { type: 'numeric' as const, canonical }
	}
	
	// Algebraic expressions
	if (/[a-z]|√|∛|π|∞|\^|\*\*|sin|cos|tan|log|ln|\+|\-|\*|\/|\(|\)|=/.test(t.toLowerCase())) {
		const canonical: { expression: string; synonyms?: string[] } = { expression: t }
		if (synonyms && synonyms.length > 0) canonical.synonyms = synonyms
		return { type: 'algebra' as const, canonical }
	}
	
	// Text answers
	const canonical: { text: string; synonyms?: string[] } = { text: t.toLowerCase() }
	if (synonyms && synonyms.length > 0) canonical.synonyms = synonyms
	return { type: 'short' as const, canonical }
}

function getAnswerType(input: string): 'numeric' | 'mc' | 'short' | 'algebra' | 'unknown' {
	const t = input.trim()
	if (/^[A-D]$/i.test(t)) return 'mc'
	
	// Simple numbers (integers, decimals, fractions, scientific notation)
	if (/^[-+]?\d+\/\d+$/.test(t) || /^[-+]?((\d+\.?\d*)|(\d*\.?\d+))(e[-+]?\d+)?$/.test(t)) return 'numeric'
	
	// Algebraic expressions (contains variables, operators, functions, radicals)
	if (/[a-z]|√|∛|π|∞|\^|\*\*|sin|cos|tan|log|ln|\+|\-|\*|\/|\(|\)|=/.test(t.toLowerCase())) return 'algebra'
	
	if (t.length > 0) return 'short'
	return 'unknown'
}

function formatGradingRules(problem: { type: string; canonical: unknown }): string {
	if (problem.type === 'numeric') {
		const canonical = problem.canonical as { num?: string; units?: string; tolerance?: number }
		let rules = `Number: ${canonical.num || canonical}`
		if (canonical.units) rules += ` (with units: ${canonical.units})`
		if (canonical.tolerance !== undefined) rules += ` (tolerance: ±${canonical.tolerance})`
		else rules += ` (tolerance: 0.5% default)`
		return rules
	}
	if (problem.type === 'mc') {
		const canonical = problem.canonical as string
		return `Multiple Choice: Exactly "${canonical}"`
	}
	if (problem.type === 'algebra') {
		const canonical = problem.canonical as { expression?: string; synonyms?: string[] } | string
		const expr = typeof canonical === 'string' ? canonical : canonical.expression || canonical
		let rules = `Algebra: "${expr}"`
		if (typeof canonical !== 'string' && canonical.synonyms && canonical.synonyms.length > 0) {
			rules += ` (also accepts: ${canonical.synonyms.join(', ')})`
		}
		return rules
	}
	if (problem.type === 'short') {
		const canonical = problem.canonical as { text?: string; synonyms?: string[] } | string
		const text = typeof canonical === 'string' ? canonical : canonical.text || canonical
		let rules = `Text: "${text}"`
		if (typeof canonical !== 'string' && canonical.synonyms && canonical.synonyms.length > 0) {
			rules += ` (also accepts: ${canonical.synonyms.join(', ')})`
		}
		return rules
	}
	return 'Unknown grading rules'
}

export default function AssignmentDetail() {
	const router = useRouter()
	const { id } = router.query
	const assignmentId = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? '', [id])
	const [assignment, setAssignment] = useState<{ title: string | null } | null>(null)
	const [classroom, setClassroom] = useState<{ id: string; join_code: string; name: string | null } | null>(null)
	const [problems, setProblems] = useState<{ id: string; description: string | null; type: string; canonical: unknown }[]>([])
	const [description, setDescription] = useState('')
	const [answer, setAnswer] = useState('')
	const [units, setUnits] = useState('')
	const [tolerance, setTolerance] = useState<number | undefined>(undefined)
	const [synonyms, setSynonyms] = useState('')
	const [loading, setLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [copySuccess, setCopySuccess] = useState(false)
	const [joinCodeCopySuccess, setJoinCodeCopySuccess] = useState(false)
	const [editingProblem, setEditingProblem] = useState<string | null>(null)
	const [editDescription, setEditDescription] = useState('')
	const [editAnswer, setEditAnswer] = useState('')
	const [editUnits, setEditUnits] = useState('')
	const [editTolerance, setEditTolerance] = useState<number | undefined>(undefined)
	const [editSynonyms, setEditSynonyms] = useState('')

	const load = useCallback(async () => {
		if (!assignmentId) return
		setError(null)
		try {
			const supabase = getSupabaseBrowser()
			const [assignmentRes, problemsRes] = await Promise.all([
				supabase.from('assignments').select('title, classroom:classrooms(id, name, join_code)').eq('id', assignmentId).maybeSingle(),
				supabase.from('problems').select('id, description, type, canonical').eq('assignment_id', assignmentId).order('order_index')
			])
			if (assignmentRes.error) throw assignmentRes.error
			if (problemsRes.error) throw problemsRes.error
			setAssignment(assignmentRes.data)
			const classroomData = Array.isArray(assignmentRes.data?.classroom) 
				? assignmentRes.data.classroom[0] 
				: assignmentRes.data?.classroom
			setClassroom(classroomData || null)
			setProblems(problemsRes.data ?? [])
		} catch {
			setError('Failed to load assignment')
		} finally {
			setInitialLoading(false)
		}
	}, [assignmentId])

	useEffect(() => { void load() }, [load])

	async function addProblem(e: React.FormEvent) {
		e.preventDefault()
		if (!description.trim() || !answer.trim()) {
			setError('Both problem description and correct answer are required')
			return
		}
		setLoading(true)
		setError(null)
		setSuccess(null)
		try {
			const synonymsArray = synonyms.trim() ? synonyms.split(',').map(s => s.trim()).filter(Boolean) : []
			const { type, canonical } = inferTypeAndCanonical(answer, tolerance, units.trim() || undefined, synonymsArray)
			const supabase = getSupabaseBrowser()
			const { error } = await supabase.from('problems').insert({ 
				assignment_id: assignmentId, 
				description: description.trim(),
				type, 
				canonical: (canonical as unknown) as Record<string, unknown>,
				order_index: problems.length
			})
			if (error) throw error
			setDescription('')
			setAnswer('')
			setUnits('')
			setTolerance(undefined)
			setSynonyms('')
			setSuccess('Problem added successfully!')
			await load()
		} catch {
			setError('Failed to add problem')
		} finally {
			setLoading(false)
		}
	}

	async function deleteProblem(problemId: string, problemDescription: string) {
		if (!confirm(`Are you sure you want to delete this problem: "${problemDescription.slice(0, 50)}..."?`)) {
			return
		}
		setDeleteLoading(problemId)
		setError(null)
		try {
			const supabase = getSupabaseBrowser()
			const { error } = await supabase.from('problems').delete().eq('id', problemId)
			if (error) throw error
			setSuccess('Problem deleted successfully')
			await load()
		} catch {
			setError('Failed to delete problem')
		} finally {
			setDeleteLoading(null)
		}
	}

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopySuccess(true)
			setTimeout(() => setCopySuccess(false), 2000)
		} catch {
			setError('Failed to copy link')
		}
	}

	async function copyJoinCode(joinCode: string) {
		try {
			await navigator.clipboard.writeText(joinCode)
			setJoinCodeCopySuccess(true)
			setTimeout(() => setJoinCodeCopySuccess(false), 2000)
		} catch {
			setError('Failed to copy join code')
		}
	}

	function startEditProblem(problem: { id: string; description: string | null; canonical: unknown }) {
		setEditingProblem(problem.id)
		setEditDescription(problem.description || '')
		
		// Extract the answer and all grading rules from canonical
		let answerText = ''
		let units = ''
		let tolerance: number | undefined = undefined
		let synonyms = ''
		
		if (problem.canonical) {
			if (typeof problem.canonical === 'string') {
				answerText = problem.canonical
			} else {
				// Extract answer based on type
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const canonical = problem.canonical as any
				if (canonical.num) {
					answerText = canonical.num
					units = canonical.units || ''
					tolerance = canonical.tolerance
				} else if (canonical.text) {
					answerText = canonical.text
					if (canonical.synonyms && Array.isArray(canonical.synonyms)) {
						synonyms = canonical.synonyms.join(', ')
					}
				} else if (canonical.expression) {
					answerText = canonical.expression
					if (canonical.synonyms && Array.isArray(canonical.synonyms)) {
						synonyms = canonical.synonyms.join(', ')
					}
				} else {
					answerText = String(problem.canonical)
				}
			}
		}
		
		setEditAnswer(answerText)
		setEditUnits(units)
		setEditTolerance(tolerance)
		setEditSynonyms(synonyms)
	}

	function cancelEditProblem() {
		setEditingProblem(null)
		setEditDescription('')
		setEditAnswer('')
		setEditUnits('')
		setEditTolerance(undefined)
		setEditSynonyms('')
	}

	async function saveEditProblem(problemId: string) {
		if (!editDescription.trim() || !editAnswer.trim()) {
			setError('Both description and answer are required')
			return
		}

		setLoading(true)
		setError(null)
		setSuccess(null)

		try {
			const editSynonymsArray = editSynonyms.trim() ? editSynonyms.split(',').map(s => s.trim()).filter(Boolean) : []
			const { type, canonical } = inferTypeAndCanonical(editAnswer.trim(), editTolerance, editUnits.trim() || undefined, editSynonymsArray)
			const supabase = getSupabaseBrowser()

			const { error: updateError } = await supabase
				.from('problems')
				.update({
					description: editDescription.trim(),
					type,
					canonical
				})
				.eq('id', problemId)

			if (updateError) throw updateError

			setSuccess('Problem updated successfully!')
			setEditingProblem(null)
			setEditDescription('')
			setEditAnswer('')
			setEditUnits('')
			setEditTolerance(undefined)
			setEditSynonyms('')
			await load()
		} catch (err) {
			setError(`Failed to update problem: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setLoading(false)
		}
	}

	const shareUrl = assignmentId && problems.length > 0 ? `${getBaseUrl()}/s/assignments/${assignmentId}/${problems[0].id}` : ''

	if (initialLoading) {
		return (
			<RoleGuard requiredRole="teacher">
				<AssignmentDetailSkeleton />
			</RoleGuard>
		)
	}

	return (
		<RoleGuard requiredRole="teacher">
			<div className="max-w-4xl mx-auto">
				{/* Header with back button */}
				<div className="mb-6">
					<nav className="flex items-center gap-2 text-sm text-slate-600 mb-2">
						<Link href="/t" className="hover:text-slate-900">Classrooms</Link>
						<span>/</span>
						{classroom && (
							<>
								<Link 
									href={`/t/assignments?classroom=${classroom.id}`} 
									className="hover:text-slate-900"
								>
									{classroom.name || 'Untitled Classroom'}
								</Link>
								<span>/</span>
							</>
						)}
						<span className="text-slate-900 font-medium">{assignment?.title || 'Untitled Assignment'}</span>
					</nav>
					<div className="flex items-center gap-3 mb-2">
						<button 
							onClick={() => router.back()}
							className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<h1 className="text-3xl font-bold text-slate-900">{assignment?.title || 'Untitled Assignment'}</h1>
					</div>
					<p className="text-slate-600">Add problems below, then share the link with students.</p>
				</div>

				{problems.length > 0 && (
					<div className="mb-6 space-y-4">
						{/* Option 1: Direct Assignment Link */}
						<div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
							<h3 className="text-lg font-semibold text-emerald-800 mb-2">Option 1: Share This Assignment</h3>
							<p className="text-sm text-emerald-700 mb-3">Students click the link and go straight to this assignment</p>
							<div className="flex items-center gap-3">
								<input 
									value={shareUrl} 
									readOnly 
									className="flex-1 rounded-lg border border-emerald-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" 
								/>
								<button 
									onClick={copyShareLink}
									className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
								>
									{copySuccess ? 'Copied!' : 'Copy Link'}
								</button>
							</div>
						</div>

						{/* Option 2: Classroom Join Code */}
						<div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
							<h3 className="text-lg font-semibold text-blue-800 mb-2">Option 2: Share Classroom Code</h3>
							<p className="text-sm text-blue-700 mb-3">Students enter this code to see ALL assignments in your classroom</p>
							<div className="flex items-center gap-3">
								<div className="flex-1 flex items-center gap-3">
									<span className="text-sm font-medium text-blue-800">Join Code:</span>
									<span className="font-mono text-2xl font-bold text-blue-900 bg-white px-4 py-2 rounded-lg border border-blue-300">
										{classroom?.join_code || 'Loading...'}
									</span>
								</div>
								<button 
									onClick={() => copyJoinCode(classroom?.join_code || '')}
									className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								>
									{joinCodeCopySuccess ? 'Copied!' : 'Copy Code'}
								</button>
							</div>
						</div>
					</div>
				)}

				<div className="mb-6 p-6 border border-slate-200 rounded-xl bg-white">
					<h3 className="text-xl font-semibold mb-2">Add New Problem</h3>
					<p className="text-slate-600 mb-6">Create a problem and set up simple grading rules</p>
					
					<form onSubmit={addProblem} className="space-y-6">
						{/* Problem Description */}
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">Problem Description</label>
							<textarea 
								value={description} 
								onChange={(e) => setDescription(e.target.value)} 
								placeholder="e.g., What is the acceleration due to gravity on Earth?"
								className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
								rows={3}
								required
							/>
						</div>

						{/* Correct Answer */}
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">Correct Answer</label>
							<input 
								value={answer} 
								onChange={(e) => setAnswer(e.target.value)} 
								placeholder="e.g., 9.81, B, vertex"
								className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
								required
							/>
							
							{/* Answer Type Detection & Grading Rules */}
							{answer.trim() && (
								<div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
									<div className="flex items-center gap-2 mb-3">
										<div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
										<span className="text-sm font-medium text-slate-700">
											Detected: {getAnswerType(answer) === 'numeric' ? '🔢 Number Answer' : 
											         getAnswerType(answer) === 'mc' ? '📝 Multiple Choice (A-D)' : 
											         getAnswerType(answer) === 'algebra' ? '🧮 Algebra Expression' : 
											         getAnswerType(answer) === 'short' ? '✏️ Text Answer' : '❓ Unknown'}
										</span>
									</div>

									{/* Grading Rules based on type */}
									{getAnswerType(answer) === 'numeric' && (
										<div className="space-y-3">
											<div className="text-sm text-slate-600 mb-2">
												<strong>What students will need to match:</strong> The number {answer}
											</div>
											
											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="block text-xs font-medium text-slate-600 mb-1">Units (optional)</label>
													<input 
														value={units} 
														onChange={(e) => setUnits(e.target.value)} 
														placeholder="e.g., m/s², kg, °C"
														className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
													/>
													<p className="text-xs text-slate-500 mt-1">If specified, students must include units</p>
												</div>
												<div>
													<label className="block text-xs font-medium text-slate-600 mb-1">Tolerance (optional)</label>
													<input 
														type="number" 
														step="0.01"
														value={tolerance ?? ''} 
														onChange={(e) => setTolerance(e.target.value ? Number(e.target.value) : undefined)} 
														placeholder="e.g., 0.1"
														className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
													/>
													<p className="text-xs text-slate-500 mt-1">How close answers need to be (default: 0.5%)</p>
												</div>
											</div>
										</div>
									)}

									{getAnswerType(answer) === 'mc' && (
										<div className="text-sm text-slate-600">
											<strong>What students will need to match:</strong> Exactly &quot;{answer.toUpperCase()}&quot;
											<br />
											<span className="text-slate-500">Multiple choice answers must be exactly A, B, C, or D</span>
										</div>
									)}

									{getAnswerType(answer) === 'algebra' && (
										<div className="space-y-3">
											<div className="text-sm text-slate-600 mb-2">
												<strong>What students will need to match:</strong> &quot;{answer}&quot;
											</div>
											
											<div>
												<label className="block text-xs font-medium text-slate-600 mb-1">Also accept these forms (optional)</label>
												<input 
													value={synonyms} 
													onChange={(e) => setSynonyms(e.target.value)} 
													placeholder="e.g., 2*sqrt(15) + 5x, x^2 + 3"
													className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
												/>
												<p className="text-xs text-slate-500 mt-1">Enter equivalent algebraic forms, separated by commas</p>
											</div>
											
											<div className="text-xs text-slate-500 bg-blue-50 p-3 rounded border border-blue-200">
												<strong>Tip:</strong> You can use either fancy symbols (√, π, ²) or simple text (sqrt, pi, ^2).
												<br />Examples: <code>5x + 2√15</code> or <code>5x + 2*sqrt(15)</code> both work the same way.
											</div>
										</div>
									)}

									{getAnswerType(answer) === 'short' && (
										<div className="space-y-3">
											<div className="text-sm text-slate-600 mb-2">
												<strong>What students will need to match:</strong> &quot;{answer}&quot; (case-insensitive)
											</div>
											
											<div>
												<label className="block text-xs font-medium text-slate-600 mb-1">Also accept these answers (optional)</label>
												<input 
													value={synonyms} 
													onChange={(e) => setSynonyms(e.target.value)} 
													placeholder="e.g., peak, summit, top"
													className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
												/>
												<p className="text-xs text-slate-500 mt-1">Separate multiple answers with commas</p>
											</div>
										</div>
									)}
								</div>
							)}
						</div>

						<LoadingButton
							type="submit"
							loading={loading}
							disabled={!answer.trim() || !description.trim()}
							className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
						>
							{loading ? 'Adding Problem…' : 'Add Problem & Grading Rules'}
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

				<div>
					<h3 className="text-lg font-semibold mb-3">Problems ({problems.length})</h3>
					{problems.length === 0 ? (
						<p className="text-slate-500 text-sm">No problems yet. Add your first problem above.</p>
					) : (
						<ul className="space-y-3">
							{problems.map((p, i) => (
								<li key={p.id} className="rounded-lg border border-slate-200 bg-white px-6 py-4 hover:shadow-sm transition-shadow">
									{editingProblem === p.id ? (
										// Edit mode
										<div className="space-y-4">
											<div className="text-sm font-semibold text-slate-900">Editing Problem {i + 1}</div>
											
											<div>
												<label className="block text-sm font-medium text-slate-700 mb-1">Problem Description</label>
												<textarea
													value={editDescription}
													onChange={(e) => setEditDescription(e.target.value)}
													placeholder="e.g., What is the acceleration due to gravity on Earth?"
													className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
													rows={3}
													required
												/>
											</div>

											<div>
												<label className="block text-sm font-medium text-slate-700 mb-2">Correct Answer</label>
												<input
													type="text"
													value={editAnswer}
													onChange={(e) => setEditAnswer(e.target.value)}
													placeholder="e.g., 9.81, B, vertex"
													className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
													required
												/>
												
												{/* Answer Type Detection & Grading Rules for Editing */}
												{editAnswer.trim() && (
													<div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
														<div className="flex items-center gap-2 mb-3">
															<div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
															<span className="text-sm font-medium text-slate-700">
																Detected: {getAnswerType(editAnswer) === 'numeric' ? '🔢 Number Answer' : 
																         getAnswerType(editAnswer) === 'mc' ? '📝 Multiple Choice (A-D)' : 
																         getAnswerType(editAnswer) === 'short' ? '✏️ Text Answer' : '❓ Unknown'}
															</span>
														</div>

														{/* Grading Rules based on type */}
														{getAnswerType(editAnswer) === 'numeric' && (
															<div className="space-y-3">
																<div className="text-sm text-slate-600 mb-2">
																	<strong>What students will need to match:</strong> The number {editAnswer}
																</div>
																
																<div className="grid grid-cols-2 gap-4">
																	<div>
																		<label className="block text-xs font-medium text-slate-600 mb-1">Units (optional)</label>
																		<input 
																			value={editUnits} 
																			onChange={(e) => setEditUnits(e.target.value)} 
																			placeholder="e.g., m/s², kg, °C"
																			className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
																		/>
																		<p className="text-xs text-slate-500 mt-1">If specified, students must include units</p>
																	</div>
																	<div>
																		<label className="block text-xs font-medium text-slate-600 mb-1">Tolerance (optional)</label>
																		<input 
																			type="number" 
																			step="0.01"
																			value={editTolerance ?? ''} 
																			onChange={(e) => setEditTolerance(e.target.value ? Number(e.target.value) : undefined)} 
																			placeholder="e.g., 0.1"
																			className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
																		/>
																		<p className="text-xs text-slate-500 mt-1">How close answers need to be (default: 0.5%)</p>
																	</div>
																</div>
															</div>
														)}

														{getAnswerType(editAnswer) === 'mc' && (
															<div className="text-sm text-slate-600">
																<strong>What students will need to match:</strong> Exactly &quot;{editAnswer.toUpperCase()}&quot;
																<br />
																<span className="text-slate-500">Multiple choice answers must be exactly A, B, C, or D</span>
															</div>
														)}

														{getAnswerType(editAnswer) === 'short' && (
															<div className="space-y-3">
																<div className="text-sm text-slate-600 mb-2">
																	<strong>What students will need to match:</strong> &quot;{editAnswer}&quot; (case-insensitive)
																</div>
																
																<div>
																	<label className="block text-xs font-medium text-slate-600 mb-1">Also accept these answers (optional)</label>
																	<input 
																		value={editSynonyms} 
																		onChange={(e) => setEditSynonyms(e.target.value)} 
																		placeholder="e.g., peak, summit, top"
																		className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
																	/>
																	<p className="text-xs text-slate-500 mt-1">Separate multiple answers with commas</p>
																</div>
															</div>
														)}
													</div>
												)}
											</div>

											<div className="flex items-center gap-3">
												<button
													onClick={() => saveEditProblem(p.id)}
													disabled={loading}
													className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
												>
													{loading ? 'Saving...' : 'Save Problem & Grading Rules'}
												</button>
												<button
													onClick={cancelEditProblem}
													disabled={loading}
													className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50"
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										// View mode
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="text-sm font-semibold text-slate-900 mb-1">Problem {i + 1}</div>
												<div className="text-sm text-slate-700 mb-2">{p.description || 'No description'}</div>
												<div className="text-xs text-slate-500 mb-1">Type: {p.type}</div>
												<div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
													📋 {formatGradingRules(p)}
												</div>
											</div>
											<div className="flex items-center gap-2 ml-4">
												<button
													onClick={() => startEditProblem(p)}
													className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
												>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
													</svg>
													Edit
												</button>
												<a 
													className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2" 
													href={`/s/assignments/${assignmentId}/${p.id}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
													</svg>
													Preview
												</a>
												<button 
													onClick={() => deleteProblem(p.id, p.description || 'No description')}
													disabled={deleteLoading === p.id}
													className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
												>
													{deleteLoading === p.id ? (
														<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
														</svg>
													) : (
														<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
														</svg>
													)}
													{deleteLoading === p.id ? 'Deleting…' : 'Delete'}
												</button>
											</div>
										</div>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</RoleGuard>
	)
}
