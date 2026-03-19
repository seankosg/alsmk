
ALTER TABLE public.tasks ADD COLUMN parent_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN is_summary boolean NOT NULL DEFAULT false;
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
