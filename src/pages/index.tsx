import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import { PageLoading } from '@/components/Loading'

export default function Home() {
	const router = useRouter()
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function checkAuth() {
			const supabase = getSupabaseBrowser()
			const { data: { user } } = await supabase.auth.getUser()
			if (user) {
				// User is signed in, check their role and redirect
				const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
				const role = data?.role as 'teacher' | 'student' | undefined
				if (role) {
					router.replace(role === 'teacher' ? '/t' : '/s')
					return
				}
			}
			setLoading(false)
		}
		checkAuth()
	}, [router])

	if (loading) {
		return <PageLoading message="Welcome to Goblins..." />
	}
	return (
		<section className="py-16">
			<div className="mx-auto max-w-4xl">
				<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
					<span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">Goblins</span>{' '}
					<span className="text-slate-900">Auto‑Grader</span>
				</h1>
				<p className="mt-4 text-lg text-slate-600">
					Practice assignments with deterministic auto‑grading. Keep students in flow; keep teachers in control.
				</p>
				<div className="mt-8 flex flex-wrap items-center gap-3">
					<Link href="/auth" className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-white shadow-sm hover:bg-emerald-700">Get Started</Link>
					<Link href="/auth" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-slate-900 hover:border-slate-400">Sign In</Link>
				</div>
				<div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="text-sm font-semibold">For Students</div>
						<div className="mt-1 text-sm text-slate-600">Join with a class link, open the assignment, write your final answer in the dock, hit Submit, and see your score instantly. If we can’t read it, rewrite or type it.</div>
					</div>
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="text-sm font-semibold">For Teachers</div>
						<div className="mt-1 text-sm text-slate-600">Unlimited auto‑graded practice. Share in one click. Override any result in seconds.</div>
					</div>
				</div>
			</div>
		</section>
	)
}
