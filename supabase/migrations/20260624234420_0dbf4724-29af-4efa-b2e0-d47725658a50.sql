ALTER TABLE public.mdr_milestone_snapshots
  ADD COLUMN IF NOT EXISTS drawing_count_sd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drawing_count_dd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drawing_count_cd integer NOT NULL DEFAULT 0;