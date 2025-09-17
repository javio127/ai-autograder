-- Enable RLS
alter table public.users enable row level security;
alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.problems enable row level security;
alter table public.submissions enable row level security;
alter table public.artifacts enable row level security;

-- Users: user can read own row
create policy users_self_select on public.users for select using (id = auth.uid());

-- Classrooms: teacher can manage their classrooms
create policy classrooms_teacher_select on public.classrooms for select using (teacher_id = auth.uid());
create policy classrooms_teacher_ins on public.classrooms for insert with check (teacher_id = auth.uid());
create policy classrooms_teacher_upd on public.classrooms for update using (teacher_id = auth.uid());
create policy classrooms_teacher_del on public.classrooms for delete using (teacher_id = auth.uid());

-- Enrollments: student can read own; teacher can read for owned classrooms
create policy enroll_student_select on public.enrollments for select using (student_id = auth.uid());
create policy enroll_teacher_select on public.enrollments for select using (exists (select 1 from public.classrooms c where c.id = enrollments.classroom_id and c.teacher_id = auth.uid()));
create policy enroll_student_insert on public.enrollments for insert with check (student_id = auth.uid());

-- Assignments: teacher can manage; students can select if enrolled
create policy assignments_teacher_all on public.assignments for all using (exists (select 1 from public.classrooms c where c.id = assignments.classroom_id and c.teacher_id = auth.uid())) with check (exists (select 1 from public.classrooms c where c.id = assignments.classroom_id and c.teacher_id = auth.uid()));
create policy assignments_student_select on public.assignments for select using (exists (select 1 from public.enrollments e join public.classrooms c on c.id = e.classroom_id where e.student_id = auth.uid() and c.id = assignments.classroom_id));

-- Problems: teacher select/manage for owned classes; students select if enrolled
create policy problems_teacher_all on public.problems for all using (exists (select 1 from public.assignments a join public.classrooms c on c.id = a.classroom_id where a.id = problems.assignment_id and c.teacher_id = auth.uid())) with check (exists (select 1 from public.assignments a join public.classrooms c on c.id = a.classroom_id where a.id = problems.assignment_id and c.teacher_id = auth.uid()));
create policy problems_student_select on public.problems for select using (exists (select 1 from public.assignments a join public.classrooms c on c.id = a.classroom_id join public.enrollments e on e.classroom_id = c.id where e.student_id = auth.uid() and a.id = problems.assignment_id));

-- Submissions: students can manage own; teachers can read for owned classes and update for override
create policy submissions_student_all on public.submissions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy submissions_teacher_select on public.submissions for select using (exists (select 1 from public.problems p join public.assignments a on a.id = p.assignment_id join public.classrooms c on c.id = a.classroom_id where p.id = submissions.problem_id and c.teacher_id = auth.uid()));
create policy submissions_teacher_update on public.submissions for update using (exists (select 1 from public.problems p join public.assignments a on a.id = p.assignment_id join public.classrooms c on c.id = a.classroom_id where p.id = submissions.problem_id and c.teacher_id = auth.uid()));

-- Artifacts: students/teachers can read if they can read the linked submission
create policy artifacts_read_if_submission on public.artifacts for select using (exists (select 1 from public.submissions s where s.id = artifacts.submission_id and (s.student_id = auth.uid() or exists (select 1 from public.problems p join public.assignments a on a.id = p.assignment_id join public.classrooms c on c.id = a.classroom_id where p.id = s.problem_id and c.teacher_id = auth.uid()))));
create policy artifacts_write_student on public.artifacts for insert with check (exists (select 1 from public.submissions s where s.id = artifacts.submission_id and s.student_id = auth.uid()));
