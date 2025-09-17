import { ReactNode } from 'react'

type LoadingSpinnerProps = {
	size?: 'sm' | 'md' | 'lg'
	color?: 'emerald' | 'blue' | 'slate'
	className?: string
}

export function LoadingSpinner({ size = 'md', color = 'emerald', className = '' }: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6', 
		lg: 'w-8 h-8'
	}
	
	const colorClasses = {
		emerald: 'border-emerald-600',
		blue: 'border-blue-600',
		slate: 'border-slate-600'
	}
	
	return (
		<div className={`animate-spin rounded-full border-2 border-transparent ${sizeClasses[size]} ${colorClasses[color]} border-t-current ${className}`} />
	)
}

type LoadingScreenProps = {
	message?: string
	size?: 'sm' | 'md' | 'lg'
	fullScreen?: boolean
}

export function LoadingScreen({ message = 'Loading...', size = 'lg', fullScreen = true }: LoadingScreenProps) {
	const containerClass = fullScreen 
		? 'flex items-center justify-center min-h-screen' 
		: 'flex items-center justify-center py-12'
	
	return (
		<div className={containerClass}>
			<div className="text-center">
				<LoadingSpinner size={size} className="mx-auto" />
				<p className="mt-4 text-slate-600 text-sm">{message}</p>
			</div>
		</div>
	)
}

type LoadingButtonProps = {
	loading: boolean
	children: ReactNode
	className?: string
	disabled?: boolean
	onClick?: () => void
	type?: 'button' | 'submit'
}

export function LoadingButton({ 
	loading, 
	children, 
	className = '', 
	disabled = false,
	onClick,
	type = 'button'
}: LoadingButtonProps) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={loading || disabled}
			className={`inline-flex items-center gap-2 ${className} ${loading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
		>
			{loading && <LoadingSpinner size="sm" />}
			{children}
		</button>
	)
}

type PageLoadingProps = {
	message?: string
}

export function PageLoading({ message = 'Loading page...' }: PageLoadingProps) {
	return (
		<div className="flex items-center justify-center min-h-screen bg-slate-50">
			<div className="text-center">
				<div className="relative">
					<LoadingSpinner size="lg" className="mx-auto" />
					{/* Pulsing background circle */}
					<div className="absolute inset-0 animate-ping">
						<div className="w-8 h-8 mx-auto rounded-full bg-emerald-100 opacity-75"></div>
					</div>
				</div>
				<p className="mt-6 text-slate-600 font-medium">{message}</p>
			</div>
		</div>
	)
}

type InlineLoadingProps = {
	message?: string
	size?: 'sm' | 'md'
}

export function InlineLoading({ message = 'Loading...', size = 'sm' }: InlineLoadingProps) {
	return (
		<div className="flex items-center gap-2 text-slate-600">
			<LoadingSpinner size={size} />
			<span className="text-sm">{message}</span>
		</div>
	)
}
