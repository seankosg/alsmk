ALTER TABLE public.mdr_milestone_snapshots
  ADD COLUMN IF NOT EXISTS sub_idx INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.mdr_milestone_snapshots
  DROP CONSTRAINT IF EXISTS mdr_milestone_snapshots_uniq;

ALTER TABLE public.mdr_milestone_snapshots
  ADD CONSTRAINT mdr_milestone_snapshots_uniq
  UNIQUE (as_of, building, discipline, stage, pct, sub_idx);