ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS in_scope_sd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_scope_dd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_scope_cd boolean NOT NULL DEFAULT false;