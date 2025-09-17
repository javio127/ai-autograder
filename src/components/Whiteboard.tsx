import { useRef, useEffect, useState } from 'react'

type Props = { 
	height?: number
	onAnswerSubmit?: (imageBase64: string) => void
	expectedType?: 'numeric' | 'mc' | 'short' | 'algebra'
	unitsHint?: string
}

export default function Whiteboard({ height = 800, onAnswerSubmit }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const answerCanvasRef = useRef<HTMLCanvasElement>(null)
	const [isDrawing, setIsDrawing] = useState(false)
	const [isDrawingAnswer, setIsDrawingAnswer] = useState(false)
	const [currentCanvas, setCurrentCanvas] = useState<'main' | 'answer'>('main')
	const [isErasing, setIsErasing] = useState(false)

	// Initialize canvases
	useEffect(() => {
		const canvas = canvasRef.current
		const answerCanvas = answerCanvasRef.current
		if (!canvas || !answerCanvas) return

		// Main canvas setup
		const ctx = canvas.getContext('2d')
		if (ctx) {
			canvas.width = canvas.offsetWidth
			canvas.height = canvas.offsetHeight
			ctx.fillStyle = '#ffffff'
			ctx.fillRect(0, 0, canvas.width, canvas.height)
			ctx.strokeStyle = '#000000'
			ctx.lineWidth = 2
			ctx.lineCap = 'round'
			ctx.lineJoin = 'round'
		}

		// Answer canvas setup
		const answerCtx = answerCanvas.getContext('2d')
		if (answerCtx) {
			answerCanvas.width = answerCanvas.offsetWidth
			answerCanvas.height = answerCanvas.offsetHeight
			answerCtx.fillStyle = '#ffffff'
			answerCtx.fillRect(0, 0, answerCanvas.width, answerCanvas.height)
			answerCtx.strokeStyle = '#000000'
			answerCtx.lineWidth = 2
			answerCtx.lineCap = 'round'
			answerCtx.lineJoin = 'round'
		}
	}, [])

	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>, canvasType: 'main' | 'answer') => {
		setIsDrawing(canvasType === 'main')
		setIsDrawingAnswer(canvasType === 'answer')
		setCurrentCanvas(canvasType)
		
		const canvas = canvasType === 'main' ? canvasRef.current : answerCanvasRef.current
		if (!canvas) return
		
		const rect = canvas.getBoundingClientRect()
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		// Set up drawing or erasing mode
		if (isErasing) {
			ctx.globalCompositeOperation = 'destination-out'
			ctx.lineWidth = 20 // Bigger eraser
		} else {
			ctx.globalCompositeOperation = 'source-over'
			ctx.strokeStyle = '#000000'
			ctx.lineWidth = 2
		}
		
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'
		ctx.beginPath()
		ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
	}

	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDrawing && !isDrawingAnswer) return
		
		const canvas = currentCanvas === 'main' ? canvasRef.current : answerCanvasRef.current
		if (!canvas) return
		
		const rect = canvas.getBoundingClientRect()
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
		ctx.stroke()
	}

	const stopDrawing = () => {
		setIsDrawing(false)
		setIsDrawingAnswer(false)
	}

	const clearMain = () => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	}

	const clearAnswer = () => {
		const canvas = answerCanvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	}

	const submitAnswer = () => {
		const canvas = answerCanvasRef.current
		if (!canvas || !onAnswerSubmit) return
		
		const imageBase64 = canvas.toDataURL('image/png')
		onAnswerSubmit(imageBase64)
	}

	return (
		<div className="relative bg-white border border-slate-200 rounded-lg" style={{ height }}>
			{/* Toolbar with tools and clear button */}
			<div className="absolute top-4 right-4 z-10 flex gap-2">
				<div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
					<button
						onClick={() => setIsErasing(false)}
						className={`px-3 py-2 text-sm font-medium transition-colors ${
							!isErasing 
								? 'bg-slate-700 text-white' 
								: 'bg-white text-slate-700 hover:bg-slate-50'
						}`}
					>
						✏️ Pen
					</button>
					<button
						onClick={() => setIsErasing(true)}
						className={`px-3 py-2 text-sm font-medium transition-colors ${
							isErasing 
								? 'bg-slate-700 text-white' 
								: 'bg-white text-slate-700 hover:bg-slate-50'
						}`}
					>
						🧽 Eraser
					</button>
				</div>
				<button
					onClick={clearMain}
					className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-300"
				>
					🗑️ Clear All
				</button>
			</div>

			{/* Full whiteboard area - maximum space for problem solving */}
			<canvas
				ref={canvasRef}
				onMouseDown={(e) => startDrawing(e, 'main')}
				onMouseMove={draw}
				onMouseUp={stopDrawing}
				onMouseLeave={stopDrawing}
				className="absolute inset-0 w-full h-full rounded-lg"
				style={{ 
					cursor: isErasing 
						? 'url("data:image/svg+xml,%3csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect x=\'2\' y=\'2\' width=\'16\' height=\'16\' stroke=\'%23666\' stroke-width=\'2\' fill=\'%23f8f8f8\' rx=\'2\'/%3e%3c/svg%3e") 10 10, crosshair'
						: 'url("data:image/svg+xml,%3csvg width=\'16\' height=\'16\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3cpath d=\'M2 14L14 2M2 14L6 10L14 2M2 14L2 10L14 2\' stroke=\'%23000\' stroke-width=\'2\' fill=\'none\'/%3e%3c/svg%3e") 2 14, crosshair'
				}}
			/>
			
			{/* Final Answer box - bigger and better positioned for the larger whiteboard */}
			<div className="absolute bottom-8 right-8 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-6 shadow-xl">
				<div className="flex items-center gap-2 mb-4">
					<div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
					<div className="text-lg font-bold text-emerald-800">
						Final Answer
					</div>
				</div>
				<canvas
					ref={answerCanvasRef}
					onMouseDown={(e) => startDrawing(e, 'answer')}
					onMouseMove={draw}
					onMouseUp={stopDrawing}
					onMouseLeave={stopDrawing}
					className="bg-white border-2 border-emerald-300 rounded-lg shadow-inner"
					style={{ 
						width: '450px', 
						height: '180px',
						cursor: isErasing 
							? 'url("data:image/svg+xml,%3csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect x=\'2\' y=\'2\' width=\'16\' height=\'16\' stroke=\'%23059669\' stroke-width=\'2\' fill=\'%23f0fdf4\' rx=\'2\'/%3e%3c/svg%3e") 10 10, crosshair'
							: 'url("data:image/svg+xml,%3csvg width=\'16\' height=\'16\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3cpath d=\'M2 14L14 2M2 14L6 10L14 2M2 14L2 10L14 2\' stroke=\'%23059669\' stroke-width=\'2\' fill=\'none\'/%3e%3c/svg%3e") 2 14, crosshair'
					}}
				/>
				<div className="flex gap-3 mt-4">
					<button
						onClick={clearAnswer}
						className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
					>
						Clear
					</button>
					<button
						onClick={submitAnswer}
						className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors shadow-md"
					>
						Submit Answer
					</button>
				</div>
			</div>
		</div>
	)
}
