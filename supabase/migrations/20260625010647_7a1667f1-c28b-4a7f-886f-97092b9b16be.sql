ALTER TABLE public.mdr_milestone_snapshots
  ADD COLUMN IF NOT EXISTS stage_plan_pct numeric,
  ADD COLUMN IF NOT EXISTS stage_actual_pct numeric;