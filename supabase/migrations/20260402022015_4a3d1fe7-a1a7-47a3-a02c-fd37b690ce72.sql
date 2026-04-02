
-- Phase 1: Create data_backups table
CREATE TABLE public.data_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'manual',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view backups" ON public.data_backups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert backups" ON public.data_backups
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete backups" ON public.data_backups
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Phase 2: Add soft delete columns to teams, parts, members, milestones, calendar_events
ALTER TABLE public.teams ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.teams ADD COLUMN deleted_by uuid DEFAULT NULL;

ALTER TABLE public.parts ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.parts ADD COLUMN deleted_by uuid DEFAULT NULL;

ALTER TABLE public.members ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.members ADD COLUMN deleted_by uuid DEFAULT NULL;

ALTER TABLE public.milestones ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.milestones ADD COLUMN deleted_by uuid DEFAULT NULL;

ALTER TABLE public.calendar_events ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.calendar_events ADD COLUMN deleted_by uuid DEFAULT NULL;

-- Phase 3: Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
