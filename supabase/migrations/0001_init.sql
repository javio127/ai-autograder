-- Schema init for Goblins Auto-Grader
create extension if not exists pgcrypto;

-- Roles
create type user_role as enum ('teacher','student');

-- Users (mirror of app users; in production join to auth.users)
create table if not exists public.users (
	id uuid primary key,
	role user_role not null,
	email text
);

-- Classrooms
create table if not exists public.classrooms (
	id uuid primary key default gen_random_uuid(),
	teacher_id uuid not null references public.users(id) on delete cascade,
	join_code text not null unique
);

-- Enrollments
create table if not exists public.enrollments (
	classroom_id uuid not null references public.classrooms(id) on delete cascade,
	student_id uuid not null references public.users(id) on delete cascade,
	primary key (classroom_id, student_id)
);

-- Assignments
create table if not exists public.assignments (
	id uuid primary key default gen_random_uuid(),
	classroom_id uuid not null references public.classrooms(id) on delete cascade,
	ai_feedback_enabled boolean not null default false
);

-- Problems
create table if not exists public.problems (
	id uuid primary key default gen_random_uuid(),
	assignment_id uuid not null references public.assignments(id) on delete cascade,
	type text not null,
	canonical jsonb not null,
	order_index int not null default 0
);

-- Submissions
create table if not exists public.submissions (
	id uuid primary key default gen_random_uuid(),
	student_id uuid not null references public.users(id) on delete cascade,
	problem_id uuid not null references public.problems(id) on delete cascade,
	final_answer_source text,
	final_answer_json jsonb,
	ocr_conf numeric,
	result text,
	score int,
	reasons jsonb,
	created_at timestamptz not null default now()
);
create unique index if not exists submissions_student_problem_uniq on public.submissions (student_id, problem_id);

-- Artifacts
create table if not exists public.artifacts (
	id uuid primary key default gen_random_uuid(),
	submission_id uuid not null references public.submissions(id) on delete cascade,
	canvas_image_url text
);
