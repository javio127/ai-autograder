export function getBaseUrl() {
	if (typeof window !== 'undefined') return window.location.origin
	const vercel = process.env.NEXT_PUBLIC_VERCEL_URL
	return vercel ? `https://${vercel}` : 'http://localhost:3000'
}
