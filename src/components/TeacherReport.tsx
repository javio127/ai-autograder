type Row = { student: string; problem: string; result: 'PASS' | 'FAIL' | 'REVIEW' }

type Props = { rows: Row[] }

export default function TeacherReport({ rows }: Props) {
	return (
		<div className="space-y-2">
			{/* Header */}
			<div className="grid grid-cols-3 gap-4 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 text-sm">
				<span>Student</span>
				<span>Problem</span>
				<span>Result</span>
			</div>
			
			{/* Rows */}
			{rows.map((r, i) => (
				<div key={i} className="grid grid-cols-3 gap-4 py-3 px-4 bg-white border border-slate-200 rounded-lg items-center hover:bg-slate-50 transition-colors">
					<span className="font-medium text-slate-900">{r.student}</span>
					<span className="text-slate-700">{r.problem}</span>
					<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
						r.result === 'PASS' 
							? 'bg-green-100 text-green-800' 
							: r.result === 'FAIL' 
							? 'bg-red-100 text-red-800' 
							: 'bg-yellow-100 text-yellow-800'
					}`}>
						{r.result}
					</span>
				</div>
			))}
		</div>
	)
}
