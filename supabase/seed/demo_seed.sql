-- Demo seed (idempotent, non-destructive)
-- Run AFTER migrations. Safe to run multiple times.

-- Users
insert into public.users (id, role, email)
values
	('00000000-0000-0000-0000-000000000001','teacher','maria@example.com'),
	('00000000-0000-0000-0000-000000000002','student','jamal@example.com')
on conflict (id) do update set role=excluded.role, email=excluded.email;

-- Classroom
insert into public.classrooms (id, teacher_id, join_code, name)
values
	('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','ALG123', 'Demo Algebra Class')
on conflict (id) do update set teacher_id=excluded.teacher_id, join_code=excluded.join_code, name=excluded.name;

-- Enrollment
insert into public.enrollments (classroom_id, student_id)
values
	('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')
on conflict (classroom_id, student_id) do nothing;

-- Assignment
insert into public.assignments (id, classroom_id, ai_feedback_enabled)
values
	('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', false)
on conflict (id) do update set classroom_id=excluded.classroom_id, ai_feedback_enabled=excluded.ai_feedback_enabled;

-- Problems
insert into public.problems (id, assignment_id, type, canonical, order_index)
values
	(
		'30000000-0000-0000-0000-000000000001',
		'20000000-0000-0000-0000-000000000001',
		'numeric',
		'{"num":"9.81","units":"m/s^2"}'::jsonb,
		0
	),
	(
		'30000000-0000-0000-0000-000000000002',
		'20000000-0000-0000-0000-000000000001',
		'mc',
		'"B"'::jsonb,
		1
	),
	(
		'30000000-0000-0000-0000-000000000003',
		'20000000-0000-0000-0000-000000000001',
		'short',
		'{"text":"vertex","synonyms":["apex"]}'::jsonb,
		2
	)
on conflict (id) do update set
	assignment_id=excluded.assignment_id,
	type=excluded.type,
	canonical=excluded.canonical,
	order_index=excluded.order_index;
