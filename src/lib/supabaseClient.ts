import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
	if (typeof window === 'undefined') {
		throw new Error('Supabase browser client can only be created in the browser')
	}
	
	if (!supabaseInstance) {
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
		const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
		if (!supabaseUrl || !supabaseAnonKey) {
			throw new Error('Supabase browser env not configured')
		}
		supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
	}
	
	return supabaseInstance
}
