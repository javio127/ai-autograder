-- Add optional title for assignments
alter table public.assignments add column if not exists title text;
