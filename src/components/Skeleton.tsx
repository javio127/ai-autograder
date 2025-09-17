import { ReactNode } from 'react'

type SkeletonProps = {
	className?: string
	children?: ReactNode
}

// Base skeleton component with shimmer animation
export function Skeleton({ className = '', children }: SkeletonProps) {
	return (
		<div className={`animate-pulse bg-slate-200 rounded ${className}`}>
			{children}
		</div>
	)
}

// Specific skeleton components for common UI patterns
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
	return (
		<div className={`space-y-2 ${className}`}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton 
					key={i} 
					className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
				/>
			))}
		</div>
	)
}

export function SkeletonCard({ className = '' }: { className?: string }) {
	return (
		<div className={`border border-slate-200 rounded-lg p-6 ${className}`}>
			<Skeleton className="h-6 w-3/4 mb-4" />
			<SkeletonText lines={2} />
			<div className="flex gap-2 mt-4">
				<Skeleton className="h-8 w-20" />
				<Skeleton className="h-8 w-16" />
			</div>
		</div>
	)
}

export function SkeletonButton({ className = '' }: { className?: string }) {
	return <Skeleton className={`h-10 w-24 ${className}`} />
}

export function SkeletonInput({ className = '' }: { className?: string }) {
	return <Skeleton className={`h-10 w-full ${className}`} />
}

// Dashboard-specific skeletons
export function DashboardSkeleton() {
	return (
		<div className="max-w-4xl mx-auto p-6">
			{/* Header */}
			<div className="mb-8">
				<Skeleton className="h-8 w-64 mb-2" />
				<SkeletonText lines={1} className="w-96" />
			</div>

			{/* Create form */}
			<div className="bg-white border border-slate-200 rounded-lg p-6 mb-8">
				<Skeleton className="h-6 w-48 mb-4" />
				<div className="flex gap-4">
					<SkeletonInput className="flex-1" />
					<SkeletonButton className="w-32" />
				</div>
			</div>

			{/* Grid of cards */}
			<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		</div>
	)
}

export function AssignmentDetailSkeleton() {
	return (
		<div className="max-w-4xl mx-auto p-6">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 mb-6">
				<Skeleton className="h-4 w-16" />
				<span className="text-slate-400">/</span>
				<Skeleton className="h-4 w-24" />
				<span className="text-slate-400">/</span>
				<Skeleton className="h-4 w-32" />
			</div>

			{/* Header */}
			<div className="mb-8">
				<Skeleton className="h-8 w-80 mb-4" />
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<SkeletonText lines={2} />
					<div className="flex gap-4 mt-4">
						<SkeletonButton />
						<SkeletonButton />
					</div>
				</div>
			</div>

			{/* Add problem form */}
			<div className="bg-white border border-slate-200 rounded-lg p-6 mb-8">
				<Skeleton className="h-6 w-32 mb-4" />
				<div className="space-y-4">
					<SkeletonInput />
					<SkeletonInput />
					<div className="grid grid-cols-2 gap-4">
						<SkeletonInput />
						<SkeletonInput />
					</div>
					<SkeletonButton className="w-full" />
				</div>
			</div>

			{/* Problems list */}
			<div className="space-y-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="bg-white border border-slate-200 rounded-lg p-6">
						<div className="flex justify-between items-start mb-4">
							<Skeleton className="h-5 w-16" />
							<div className="flex gap-2">
								<SkeletonButton className="w-12 h-8" />
								<SkeletonButton className="w-12 h-8" />
							</div>
						</div>
						<SkeletonText lines={2} />
						<div className="mt-4 flex gap-4">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-32" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export function ProblemSkeleton() {
	return (
		<div className="max-w-6xl mx-auto p-6">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-4">
						<SkeletonButton className="w-20 h-8" />
						<Skeleton className="h-6 w-64" />
					</div>
					<SkeletonButton className="w-24 h-8" />
				</div>
			</div>

			{/* Problem description */}
			<div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
				<Skeleton className="h-6 w-32 mb-4" />
				<SkeletonText lines={3} />
			</div>

			{/* Whiteboard skeleton */}
			<div className="relative bg-white border border-slate-200 rounded-lg" style={{ height: '800px' }}>
				{/* Toolbar */}
				<div className="absolute top-4 right-4 z-10 flex gap-2">
					<div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
						<Skeleton className="w-16 h-10" />
						<Skeleton className="w-20 h-10" />
					</div>
					<Skeleton className="w-24 h-10" />
				</div>

				{/* Canvas area */}
				<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
				
				{/* Answer dock */}
				<div className="absolute bottom-8 right-8 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-6 shadow-xl">
					<div className="flex items-center gap-2 mb-4">
						<Skeleton className="w-2 h-2 rounded-full" />
						<Skeleton className="h-5 w-24" />
					</div>
					<Skeleton className="w-[450px] h-[180px] rounded-lg" />
					<div className="flex gap-3 mt-4">
						<SkeletonButton className="w-16 h-10" />
						<SkeletonButton className="w-28 h-10" />
					</div>
				</div>
			</div>
		</div>
	)
}

// Enhanced shimmer animation using CSS-in-JS approach
export function ShimmerSkeleton({ className = '', children }: SkeletonProps) {
	return (
		<div 
			className={`relative overflow-hidden bg-slate-200 rounded ${className}`}
			style={{
				background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
				backgroundSize: '200% 100%',
				animation: 'shimmer 2s infinite ease-in-out'
			}}
		>
			{children}
			<style jsx>{`
				@keyframes shimmer {
					0% { background-position: -200% 0; }
					100% { background-position: 200% 0; }
				}
			`}</style>
		</div>
	)
}
