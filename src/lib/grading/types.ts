export type GradeResult = 'PASS' | 'FAIL' | 'REVIEW';

export type NumericPayload = { num: string; units?: string | null };
export type MCPayload = { choice: string };
export type ShortPayload = { text: string };
export type AlgebraPayload = { expression: string };

export type SubmissionPayload = {
	source: 'vision' | 'typed' | 'typed_fallback';
	type: 'numeric' | 'mc' | 'short' | 'algebra';
	numeric?: NumericPayload;
	mc?: MCPayload;
	short?: ShortPayload;
	algebra?: AlgebraPayload;
	ocrConf?: number;
};

export type GradeResponse = {
	result: GradeResult;
	score: number;
	reasons: string[];
};

export type CanonicalNumeric = { num: string; units?: string | null; tolerance?: number }
export type CanonicalShort = { text: string; synonyms?: string[] }
export type CanonicalAlgebra = { expression: string; synonyms?: string[] }
export type Canonical =
	| { type: 'numeric'; value: CanonicalNumeric | string }
	| { type: 'mc'; value: string }
	| { type: 'short'; value: CanonicalShort | string }
	| { type: 'algebra'; value: CanonicalAlgebra | string }
