import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseClient'

export default function Layout({ children }: { children: ReactNode }) {
	const [role, setRole] = useState<'teacher' | 'student' | null>(null)
	const [signedIn, setSignedIn] = useState<boolean>(false)

	useEffect(() => {
		let cancelled = false
		async function run() {
			const supabase = getSupabaseBrowser()
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) {
				if (!cancelled) { setSignedIn(false); setRole(null) }
				return
			}
			const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
			if (!cancelled) { setSignedIn(true); setRole((data?.role as 'teacher'|'student'|undefined) ?? null) }
		}
		void run()
		return () => { cancelled = true }
	}, [])

	async function signOut() {
		const supabase = getSupabaseBrowser()
		await supabase.auth.signOut()
		window.location.href = '/auth'
	}

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
					<Link href="/" className="text-lg font-semibold tracking-tight">
						<span className="text-emerald-600">Goblins</span> Auto‑Grader
					</Link>
					<nav className="flex items-center gap-4 text-sm">
						{!signedIn && (
							<Link href="/auth" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
								Sign in
							</Link>
						)}
						{signedIn && role === 'teacher' && (
							<>
								<div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
									</svg>
									<span className="text-sm font-medium">Teacher</span>
								</div>
								<Link 
									href="/t" 
									className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
								>
									Dashboard
								</Link>
								<button 
									onClick={signOut} 
									className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
								>
									Sign out
								</button>
							</>
						)}
						{signedIn && role === 'student' && (
							<>
								<div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-blue-800">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
									</svg>
									<span className="text-sm font-medium">Student</span>
								</div>
								<Link 
									href="/s" 
									className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
								>
									Dashboard
								</Link>
								<button 
									onClick={signOut} 
									className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
								>
									Sign out
								</button>
							</>
						)}
						{signedIn && !role && (
							<div className="flex items-center gap-3">
								<span className="text-sm text-slate-500">Loading...</span>
								<button 
									onClick={signOut} 
									className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
								>
									Sign out
								</button>
							</div>
						)}
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-4 py-6">
				{children}
			</main>
		</div>
	)
}
