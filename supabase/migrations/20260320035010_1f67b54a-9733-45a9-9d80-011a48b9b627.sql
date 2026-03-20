ALTER TABLE public.tasks ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN deleted_by uuid DEFAULT NULL;