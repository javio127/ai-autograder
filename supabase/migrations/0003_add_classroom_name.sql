-- Add optional classroom name for display
alter table public.classrooms add column if not exists name text;
