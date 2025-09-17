import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import { LoadingButton } from '@/components/Loading'

export default function AuthPage() {
	const [role, setRole] = useState<'teacher' | 'student'>('teacher')
	const [mode, setMode] = useState<'signin' | 'signup'>('signin')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)


	async function handleEmailSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)
		try {
			const supabase = getSupabaseBrowser()
			if (mode === 'signup') {
				const { data, error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?role=${role}` } })
				if (err) throw err
				if (!data.session) setMessage('Check your email to confirm your account.')
				else if (data.user) {
					await fetch('/api/ensure-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id, email: data.user.email, role }) })
					window.location.href = role === 'teacher' ? '/t' : '/s'
				}
			} else {
				const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
				if (err) throw err
				if (data.user) {
					// For sign in, we need to check their existing role first
					const { data: userData } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle()
					const existingRole = userData?.role as 'teacher' | 'student' | undefined
					
					if (existingRole) {
						// User exists, redirect to their correct dashboard
						window.location.href = existingRole === 'teacher' ? '/t' : '/s'
					} else {
						// New user signing in for first time, set their chosen role
						await fetch('/api/ensure-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id, email: data.user.email, role }) })
						window.location.href = role === 'teacher' ? '/t' : '/s'
					}
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Authentication error'
			setError(msg)
		} finally {
			setLoading(false)
		}
	}

	return (
		<section className="py-16">
			<div className="mx-auto max-w-md">
				<h1 className="text-3xl font-bold tracking-tight">Welcome to Goblins</h1>
				<p className="mt-2 text-slate-600">Math practice platform for teachers and students</p>
				
				{/* Role Selection */}
				<div className="mt-8">
					<label className="block text-sm font-medium text-slate-700 mb-3">I am a:</label>
					<div className="grid grid-cols-2 gap-3">
						<button 
							onClick={() => setRole('teacher')} 
							className={`p-4 rounded-lg border-2 text-left transition-colors ${
								role === 'teacher' 
									? 'border-emerald-500 bg-emerald-50 text-emerald-900' 
									: 'border-slate-200 hover:border-slate-300'
							}`}
						>
							<div className="font-semibold">🍎 Teacher</div>
							<div className="text-xs text-slate-600 mt-1">Create assignments & manage classrooms</div>
						</button>
						<button 
							onClick={() => setRole('student')} 
							className={`p-4 rounded-lg border-2 text-left transition-colors ${
								role === 'student' 
									? 'border-emerald-500 bg-emerald-50 text-emerald-900' 
									: 'border-slate-200 hover:border-slate-300'
							}`}
						>
							<div className="font-semibold">📚 Student</div>
							<div className="text-xs text-slate-600 mt-1">Join classrooms & solve problems</div>
						</button>
					</div>
				</div>

				{/* Auth Mode Selection */}
				<div className="mt-6">
					<div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm w-full">
						<button 
							onClick={() => setMode('signin')} 
							className={`flex-1 px-3 py-2 rounded-md transition-colors ${
								mode === 'signin' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:text-slate-900'
							}`}
						>
							Sign In
						</button>
						<button 
							onClick={() => setMode('signup')} 
							className={`flex-1 px-3 py-2 rounded-md transition-colors ${
								mode === 'signup' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:text-slate-900'
							}`}
						>
							Sign Up
						</button>
					</div>
				</div>

				<form onSubmit={handleEmailSubmit} className="mt-4 grid gap-3">
					<input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
					<input aria-label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
					<LoadingButton type="submit" loading={loading} className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700">
						{loading ? 'Working…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
					</LoadingButton>
				</form>


				{error && <div role="alert" className="mt-3 text-sm text-red-600">{error}</div>}
				{message && <div className="mt-3 text-sm text-emerald-600">{message}</div>}
			</div>
		</section>
	)
}
