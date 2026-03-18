
ALTER TABLE public.tasks
  ADD COLUMN category text,
  ADD COLUMN action_plan text,
  ADD COLUMN actual_finish date;
