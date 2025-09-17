import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import NProgress from 'nprogress'
import Layout from '@/components/Layout'
import '@/styles/globals.css'

// Configure NProgress
NProgress.configure({ 
	showSpinner: false,
	speed: 400,
	minimum: 0.25,
	trickleSpeed: 200
})

export default function App({ Component, pageProps }: AppProps) {
	const router = useRouter()

	useEffect(() => {
		const handleStart = () => {
			NProgress.start()
		}
		
		const handleStop = () => {
			NProgress.done()
		}

		router.events.on('routeChangeStart', handleStart)
		router.events.on('routeChangeComplete', handleStop)
		router.events.on('routeChangeError', handleStop)

		return () => {
			router.events.off('routeChangeStart', handleStart)
			router.events.off('routeChangeComplete', handleStop)
			router.events.off('routeChangeError', handleStop)
		}
	}, [router])

	return (
		<Layout>
			<Component {...pageProps} />
		</Layout>
	)
}
