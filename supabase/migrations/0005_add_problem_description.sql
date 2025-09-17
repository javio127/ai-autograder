-- Add problem description/question text
alter table public.problems add column if not exists description text;
