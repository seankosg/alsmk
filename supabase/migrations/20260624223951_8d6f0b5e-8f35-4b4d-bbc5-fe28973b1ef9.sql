
ALTER TABLE public.mdr_milestone_cells ADD COLUMN IF NOT EXISTS label text;

CREATE TABLE IF NOT EXISTS public.mdr_milestone_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  as_of date NOT NULL,
  building text NOT NULL,
  discipline text NOT NULL,
  stage text NOT NULL,
  pct integer NOT NULL,
  label text,
  plan_date date,
  plan_pct numeric NOT NULL DEFAULT 0,
  actual_pct numeric NOT NULL DEFAULT 0,
  delta_pct numeric NOT NULL DEFAULT 0,
  drawing_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mdr_milestone_snapshots_uniq UNIQUE (as_of, building, discipline, stage, pct)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_milestone_snapshots TO authenticated;
GRANT ALL ON public.mdr_milestone_snapshots TO service_role;

ALTER TABLE public.mdr_milestone_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read snapshots"
  ON public.mdr_milestone_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated write snapshots"
  ON public.mdr_milestone_snapshots FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_mdr_milestone_snapshots_asof
  ON public.mdr_milestone_snapshots (as_of DESC, building, discipline);
