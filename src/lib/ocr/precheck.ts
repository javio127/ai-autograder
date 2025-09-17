export type PrecheckResult = { ok: boolean; conf: number; kind: 'numeric' | 'mc' | 'short' | null; text?: string };

export function localPrecheck(input: string, expected: 'numeric' | 'mc' | 'short'): PrecheckResult {
	const t = input.trim()
	if (!t) return { ok: false, conf: 0, kind: null }
	if (expected === 'numeric') {
		const ok = /^[-+]?((\d+\.?\d*)|(\d*\.?\d+))(e[-+]?\d+)?$|^[-+]?\d+\/\d+$/.test(t)
		return { ok, conf: ok ? 0.95 : 0.2, kind: 'numeric', text: t }
	}
	if (expected === 'mc') {
		const up = t.toUpperCase()
		const ok = /^[A-D]$/.test(up)
		return { ok, conf: ok ? 0.99 : 0.2, kind: 'mc', text: up }
	}
	const ok = /^[a-zA-Z ]{1,32}$/.test(t)
	return { ok, conf: ok ? 0.9 : 0.2, kind: 'short', text: t }
}
