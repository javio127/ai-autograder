import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import Whiteboard from '@/components/Whiteboard'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import { ProblemSkeleton } from '@/components/Skeleton'

type Problem = { 
	id: string;
	type: 'numeric' | 'mc' | 'short' | 'algebra'; 
	canonical: unknown; 
	description: string | null;
	assignment: { title: string | null } | null;
	order_index: number;
}

type AssignmentProgress = {
	problems: Array<{ id: string; order_index: number }>;
	currentIndex: number;
	total: number;
}

function getUnits(canonical: unknown): string | undefined {
	if (canonical && typeof canonical === 'object' && 'units' in (canonical as Record<string, unknown>)) {
		const u = (canonical as Record<string, unknown>)['units']
		return typeof u === 'string' ? u : undefined
	}
	return undefined
}

export default function Problem() {
	const router = useRouter()
	const { aid, pid } = router.query
	const [msg, setMsg] = useState('')
	const [, setBusy] = useState(false)
	const [problem, setProblem] = useState<Problem | null>(null)
	const [progress, setProgress] = useState<AssignmentProgress | null>(null)
	const [loading, setLoading] = useState(true)
	const [navigating, setNavigating] = useState(false)
	const [showNextButton, setShowNextButton] = useState(false)
	const [isComplete, setIsComplete] = useState(false)

	const load = useCallback(async () => {
		if (!aid || !pid) return
		setLoading(true)
		try {
		const supabase = getSupabaseBrowser()
		
		// Load current problem and all problems in assignment for navigation
		const [problemRes, allProblemsRes] = await Promise.all([
			supabase
				.from('problems')
				.select(`
					id,
					type, 
					canonical, 
					description,
					order_index,
					assignments!inner(title)
				`)
				.eq('assignment_id', aid)
				.eq('id', pid)
				.maybeSingle(),
			supabase
				.from('problems')
				.select('id, order_index')
				.eq('assignment_id', aid)
				.order('order_index')
		])
		
		if (!problemRes.error && problemRes.data) {
			setProblem({
				id: problemRes.data.id,
				type: problemRes.data.type as 'numeric'|'mc'|'short', 
				canonical: problemRes.data.canonical,
				description: problemRes.data.description,
				assignment: Array.isArray(problemRes.data.assignments) ? problemRes.data.assignments[0] : problemRes.data.assignments,
				order_index: problemRes.data.order_index
			})
		}
		
		if (!allProblemsRes.error && allProblemsRes.data) {
			const problems = allProblemsRes.data
			const currentIndex = problems.findIndex(p => p.id === pid)
			setProgress({
				problems,
				currentIndex,
				total: problems.length
			})
		}
		} catch (err) {
			console.error('Failed to load problem:', err)
		} finally {
			setLoading(false)
		}
	}, [aid, pid])

	useEffect(() => { void load() }, [load])

	function handleCorrectAnswer() {
		if (!progress) return
		
		// Check if this is the last problem
		if (progress.currentIndex >= progress.total - 1) {
			// Last problem - show completion message
			setMsg('🎉 Excellent work! You completed all problems in this assignment.')
			setIsComplete(true)
		} else {
			// Show next button for next problem
			setMsg('✅ Correct! Great job on this problem.')
			setShowNextButton(true)
		}
	}

	function handleNext() {
		if (!progress || navigating) return
		
		setNavigating(true)
		const nextProblem = progress.problems[progress.currentIndex + 1]
		if (nextProblem) {
			router.push(`/s/assignments/${aid}/${nextProblem.id}`)
		}
	}

	function handleBackToDashboard() {
		setNavigating(true)
		router.push('/s')
	}

	async function handleAnswerSubmit(imageBase64: string) {
		if (!problem) return
		setBusy(true)
		setMsg('Processing your answer...')
		
		try {
			// Get the current user for submissions
			const supabase = getSupabaseBrowser()
			const { data: { user } } = await supabase.auth.getUser()
			
			// First try vision extraction
			const visionResponse = await fetch('/api/vision-extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageBase64,
					expectedType: problem.type,
					expectedUnits: getUnits(problem.canonical)
				})
			})
			
			const visionResult = await visionResponse.json()
			
			if (visionResult.status === 'grade' && visionResult.payload) {
				// Vision succeeded, now grade the answer
				const extractedValue = visionResult.payload.value
				const extractedUnits = visionResult.payload.units
				const confidence = visionResult.payload.confidence
				
				// Let the grading system determine the type based on what was extracted
				// and compare it intelligently with the teacher's expected answer
				const payload = {
					source: 'vision' as const,
					extractedValue,
					extractedUnits,
					confidence
				}
				
				const gradeResponse = await fetch('/api/grade', { 
					method: 'POST', 
					headers: { 'Content-Type': 'application/json' }, 
					body: JSON.stringify({ 
						submissionId: `${aid}:${pid}:${user?.id || 'anonymous'}`, 
						payload, 
						canonical: { type: problem.type, value: problem.canonical } 
					}) 
				})
				
				const gradeData = await gradeResponse.json()
				if (gradeData.result === 'PASS') {
					setMsg(`✅ Correct! Your answer "${extractedValue}" is right.`)
					
					// Auto-navigate to next problem or completion
					setTimeout(() => {
						handleCorrectAnswer()
					}, 2000) // Give student 2 seconds to see the success message
				} else {
					setMsg(`❌ Incorrect. I read your answer as "${extractedValue}" but that&apos;s not quite right.`)
				}
			} else {
				// Vision failed
				setMsg('❌ Could not read your handwriting clearly. Please write more clearly and try again.')
			}
		} catch (error) {
			console.error('Submission error:', error)
			setMsg('Error processing your answer')
		} finally {
			setBusy(false)
		}
	}

	if (loading) {
		return <ProblemSkeleton />
	}

	if (!problem) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<h1 className="text-xl font-semibold text-slate-900 mb-2">Problem Not Found</h1>
					<p className="text-slate-600">This problem may not exist or you don&apos;t have access to it.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-slate-50 pb-24 relative">
			{/* Header */}
			<div className="bg-white border-b border-slate-200 px-6 py-4">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-lg font-semibold text-slate-900">
						{problem.assignment?.title || 'Assignment'}
					</h1>
					<p className="text-sm text-slate-600 mt-1">
						Work out your solution on the whiteboard, then submit your final answer below.
					</p>
				</div>
			</div>

			{/* Problem Description */}
			<div className="max-w-4xl mx-auto px-6 py-6">
				<div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
					<h2 className="text-xl font-semibold text-slate-900 mb-4">Problem</h2>
					<div className="text-slate-700 text-lg leading-relaxed">
						{problem.description || 'No problem description provided.'}
					</div>
				</div>

				{/* Whiteboard with integrated Answer Dock */}
				<div className="bg-white rounded-lg border border-slate-200 p-4">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium text-slate-700">Work Area</h3>
						<div className="text-xs text-slate-500">Write your final answer in the green box</div>
					</div>
					<Whiteboard 
						onAnswerSubmit={handleAnswerSubmit}
						expectedType={problem.type}
						unitsHint={getUnits(problem.canonical)}
					/>
				</div>

				{/* Feedback */}
				{msg && (
					<div className={`mt-4 p-4 rounded-lg border ${
						msg.includes('✅') || msg.includes('🎉') 
							? 'bg-emerald-50 border-emerald-200' 
							: msg.includes('❌') 
								? 'bg-red-50 border-red-200'
								: 'bg-blue-50 border-blue-200'
					}`}>
						<div className={`text-sm font-medium ${
							msg.includes('✅') || msg.includes('🎉') 
								? 'text-emerald-800' 
								: msg.includes('❌') 
									? 'text-red-800'
									: 'text-blue-800'
						}`}>
							{msg}
						</div>
						
						{/* Next Button */}
						{showNextButton && !navigating && (
							<div className="mt-4 flex items-center gap-3">
								<button
									onClick={handleNext}
									className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
								>
									Next Problem
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
									</svg>
								</button>
								<span className="text-sm text-slate-600">
									Problem {progress ? progress.currentIndex + 1 : 1} of {progress ? progress.total : 1}
								</span>
							</div>
						)}
						
						{/* Completion Buttons */}
						{isComplete && !navigating && (
							<div className="mt-4 flex items-center gap-3">
								<button
									onClick={handleBackToDashboard}
									className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 5v4" />
									</svg>
									Back to Dashboard
								</button>
								<div className="text-sm text-slate-600">
									🎉 Assignment completed!
								</div>
							</div>
						)}
					</div>
				)}
			</div>
			
		</div>
	)
}
