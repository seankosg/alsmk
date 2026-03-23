
-- Single-row table for shared CPM snapshot (all users share one network)
CREATE TABLE public.cpm_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cpm_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read snapshots"
  ON public.cpm_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert snapshots"
  ON public.cpm_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update snapshots"
  ON public.cpm_snapshots FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete snapshots"
  ON public.cpm_snapshots FOR DELETE TO authenticated USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_cpm_snapshots_updated_at
  BEFORE UPDATE ON public.cpm_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
