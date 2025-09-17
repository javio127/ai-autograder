import { useRef, useState, useEffect } from 'react'

type Props = { type: 'numeric' | 'mc' | 'short'; unitsHint?: string; onSubmit: (text: string) => void; disabled?: boolean }

export default function AnswerDock({ type, unitsHint, onSubmit, disabled }: Props) {
	const [text, setText] = useState('')
	const [mode, setMode] = useState<'draw' | 'type'>('draw')
	const [isDrawing, setIsDrawing] = useState(false)
	const [processing, setProcessing] = useState(false)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const choices = ['A', 'B', 'C', 'D']

	// Initialize canvas
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		// Set canvas size
		canvas.width = 300
		canvas.height = 80
		
		// White background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
		
		// Set drawing styles
		ctx.strokeStyle = '#000000'
		ctx.lineWidth = 2
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'
	}, [])

	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
		setIsDrawing(true)
		const canvas = canvasRef.current
		if (!canvas) return
		const rect = canvas.getBoundingClientRect()
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.beginPath()
		ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
	}

	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDrawing) return
		const canvas = canvasRef.current
		if (!canvas) return
		const rect = canvas.getBoundingClientRect()
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
		ctx.stroke()
	}

	const stopDrawing = () => {
		setIsDrawing(false)
	}

	const clearCanvas = () => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	}

	const submitDrawing = async () => {
		const canvas = canvasRef.current
		if (!canvas) return
		
		setProcessing(true)
		try {
			// Convert canvas to base64
			const imageBase64 = canvas.toDataURL('image/png')
			
			// Call vision API
			const response = await fetch('/api/vision-extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageBase64,
					expectedType: type,
					expectedUnits: unitsHint
				})
			})
			
			const result = await response.json()
			
			if (result.status === 'grade' && result.payload) {
				// Vision successfully extracted the answer
				onSubmit(result.payload.value)
			} else {
				// Vision failed, fallback to typing mode
				setMode('type')
				setText('')
			}
		} catch (error) {
			console.error('Vision extraction failed:', error)
			setMode('type')
			setText('')
		} finally {
			setProcessing(false)
		}
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 border-t border-slate-700">
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-3">
					<span className="text-sm font-medium">
						Final Answer{unitsHint ? ` (${unitsHint})` : ''}:
					</span>
					<div className="flex gap-2">
						<button
							onClick={() => setMode('draw')}
							className={`px-3 py-1 text-xs rounded ${mode === 'draw' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
						>
							Draw
						</button>
						<button
							onClick={() => setMode('type')}
							className={`px-3 py-1 text-xs rounded ${mode === 'type' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
						>
							Type
						</button>
					</div>
				</div>

				{mode === 'draw' && type !== 'mc' ? (
					<div className="flex items-center gap-3">
						<div className="flex-1">
							<div className="text-xs text-slate-400 mb-1">Write your answer clearly in the box:</div>
							<canvas
								ref={canvasRef}
								onMouseDown={startDrawing}
								onMouseMove={draw}
								onMouseUp={stopDrawing}
								onMouseLeave={stopDrawing}
								className="border border-slate-600 rounded bg-white cursor-crosshair"
								style={{ width: '300px', height: '80px' }}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<button
								onClick={clearCanvas}
								className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded"
							>
								Clear
							</button>
							<button
								onClick={submitDrawing}
								disabled={disabled || processing}
								className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 rounded font-semibold disabled:opacity-50"
							>
								{processing ? 'Reading...' : 'Submit'}
							</button>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-3">
						{type === 'mc' ? (
							<div className="flex gap-2">
								{choices.map((c) => (
									<button
										key={c}
										onClick={() => setText(c)}
										disabled={disabled}
										className={`px-4 py-2 rounded font-semibold ${
											text === c 
												? 'bg-emerald-600 text-white border-2 border-emerald-400' 
												: 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
										}`}
									>
										{c}
									</button>
								))}
							</div>
						) : (
							<input
								value={text}
								onChange={(e) => setText(e.target.value)}
								placeholder={type === 'numeric' ? 'e.g., 9.81' : 'Type answer'}
								disabled={disabled}
								className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400"
							/>
						)}
						<button
							onClick={() => onSubmit(text)}
							disabled={disabled || !text.trim()}
							className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold disabled:opacity-50"
						>
							Submit
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
