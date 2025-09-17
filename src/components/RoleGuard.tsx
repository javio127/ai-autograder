import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseBrowser } from '@/lib/supabaseClient'

type Props = { requiredRole: 'teacher' | 'student'; children: React.ReactNode }

export default function RoleGuard({ requiredRole, children }: Props) {
	const router = useRouter()
	const [ok, setOk] = useState(false)

	useEffect(() => {
		let cancelled = false
		async function run() {
			const supabase = getSupabaseBrowser()
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) {
				if (!cancelled) router.replace('/auth')
				return
			}
			const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
			const role = (data?.role as 'teacher' | 'student' | undefined) || 'student'
			if (role !== requiredRole) {
				if (!cancelled) router.replace(role === 'teacher' ? '/t' : '/s')
				return
			}
			if (!cancelled) setOk(true)
		}
		void run()
		return () => { cancelled = true }
	}, [requiredRole, router])

	if (!ok) return null
	return <>{children}</>
}
