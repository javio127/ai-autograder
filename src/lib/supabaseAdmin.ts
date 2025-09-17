import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseAdmin(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error('Supabase admin env not configured')
	}
	return createClient(supabaseUrl, serviceRoleKey)
}
