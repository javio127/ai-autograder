import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'
import { PageLoading } from '@/components/Loading'

export default function Callback() {
	const router = useRouter()
	useEffect(() => {
		async function run() {
			const supabase = getSupabaseBrowser()
			const { data: { user } } = await supabase.auth.getUser()
			if (user) {
				const role = (router.query.role as string) === 'student' ? 'student' : 'teacher'
				
				// Check if user already has a role
				const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
				const existingRole = userData?.role as 'teacher' | 'student' | undefined
				
				if (existingRole) {
					// User exists, redirect to their dashboard
					router.replace(existingRole === 'teacher' ? '/t' : '/s')
				} else {
					// New user, set their role and redirect
					await fetch('/api/ensure-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, email: user.email, role }) })
					router.replace(role === 'teacher' ? '/t' : '/s')
				}
			} else {
				router.replace('/auth')
			}
		}
		run()
	}, [router])
	return <PageLoading message="Setting up your account..." />
}
