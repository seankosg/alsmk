ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS ifr_start_date DATE,
  ADD COLUMN IF NOT EXISTS ifr_issue_date DATE,
  ADD COLUMN IF NOT EXISTS ifc_start_date DATE,
  ADD COLUMN IF NOT EXISTS ifc_issue_date DATE,
  ADD COLUMN IF NOT EXISTS document_class TEXT,
  ADD COLUMN IF NOT EXISTS doc_class_code TEXT,
  ADD COLUMN IF NOT EXISTS stage_plan_sd DATE,
  ADD COLUMN IF NOT EXISTS stage_plan_dd DATE,
  ADD COLUMN IF NOT EXISTS stage_plan_cd DATE;