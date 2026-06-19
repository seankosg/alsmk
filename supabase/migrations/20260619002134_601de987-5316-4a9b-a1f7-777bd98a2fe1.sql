
-- 1) Buildings
CREATE TABLE public.mdr_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_buildings TO authenticated;
GRANT ALL ON public.mdr_buildings TO service_role;
ALTER TABLE public.mdr_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_buildings admin/pm all" ON public.mdr_buildings
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 2) Drawings
CREATE TABLE public.mdr_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_code text NOT NULL REFERENCES public.mdr_buildings(code) ON DELETE CASCADE,
  source_no text NOT NULL,                 -- 원본 A열 No.
  item_no text NOT NULL,                   -- ${BUILDING}-${source_no}
  discipline text NOT NULL,                -- ARCH/STR/MECH/ELEC...
  job_no text,
  area_code text,
  function_code text,
  serial_no text,
  activity_group text,
  drawing_title text,
  plan_finish date,
  actual_finish date,
  out_of_scope boolean NOT NULL DEFAULT false,
  source_sheet text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_code, item_no)
);
CREATE INDEX idx_mdr_drawings_building ON public.mdr_drawings(building_code);
CREATE INDEX idx_mdr_drawings_discipline ON public.mdr_drawings(discipline);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_drawings TO authenticated;
GRANT ALL ON public.mdr_drawings TO service_role;
ALTER TABLE public.mdr_drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_drawings admin/pm all" ON public.mdr_drawings
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 3) Milestones (per drawing)
CREATE TABLE public.mdr_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES public.mdr_drawings(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('SD','DD','CD')),
  pct int NOT NULL CHECK (pct BETWEEN 0 AND 100),
  increment_pct numeric(6,2) NOT NULL DEFAULT 0,
  plan_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drawing_id, stage, pct)
);
CREATE INDEX idx_mdr_milestones_drawing ON public.mdr_milestones(drawing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_milestones TO authenticated;
GRANT ALL ON public.mdr_milestones TO service_role;
ALTER TABLE public.mdr_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_milestones admin/pm all" ON public.mdr_milestones
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 4) Progress (actual Y per milestone)
CREATE TABLE public.mdr_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES public.mdr_drawings(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('SD','DD','CD')),
  pct int NOT NULL CHECK (pct BETWEEN 0 AND 100),
  is_done boolean NOT NULL DEFAULT false,
  actual_date date,
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drawing_id, stage, pct)
);
CREATE INDEX idx_mdr_progress_drawing ON public.mdr_progress(drawing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_progress TO authenticated;
GRANT ALL ON public.mdr_progress TO service_role;
ALTER TABLE public.mdr_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_progress admin/pm all" ON public.mdr_progress
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 5) Weights matrix
CREATE TABLE public.mdr_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_code text REFERENCES public.mdr_buildings(code) ON DELETE CASCADE,
  discipline text,
  stage text CHECK (stage IS NULL OR stage IN ('SD','DD','CD')),
  weight numeric(8,4) NOT NULL DEFAULT 1.0,
  is_reference_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_code, discipline, stage, is_reference_only)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_weights TO authenticated;
GRANT ALL ON public.mdr_weights TO service_role;
ALTER TABLE public.mdr_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_weights admin/pm all" ON public.mdr_weights
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 6) Weights audit log
CREATE TABLE public.mdr_weights_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weight_id uuid REFERENCES public.mdr_weights(id) ON DELETE SET NULL,
  building_code text,
  discipline text,
  stage text,
  old_weight numeric(8,4),
  new_weight numeric(8,4),
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX idx_mdr_weights_audit_changed_at ON public.mdr_weights_audit(changed_at DESC);
GRANT SELECT, INSERT ON public.mdr_weights_audit TO authenticated;
GRANT ALL ON public.mdr_weights_audit TO service_role;
ALTER TABLE public.mdr_weights_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_weights_audit admin/pm read" ON public.mdr_weights_audit
  FOR SELECT TO authenticated
  USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "mdr_weights_audit admin/pm insert" ON public.mdr_weights_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 7) Snapshots (with original workbook blob)
CREATE TABLE public.mdr_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  building_code text REFERENCES public.mdr_buildings(code) ON DELETE SET NULL,
  discipline text,
  stage text CHECK (stage IS NULL OR stage IN ('SD','DD','CD')),
  planned_pct numeric(6,2),
  actual_pct numeric(6,2),
  drawing_count int,
  done_count int,
  template_blob bytea,                       -- 원본 워크북 (Export 템플릿)
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mdr_snapshots_date ON public.mdr_snapshots(snapshot_date DESC);
CREATE INDEX idx_mdr_snapshots_building ON public.mdr_snapshots(building_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_snapshots TO authenticated;
GRANT ALL ON public.mdr_snapshots TO service_role;
ALTER TABLE public.mdr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_snapshots admin/pm all" ON public.mdr_snapshots
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- 8) Import logs
CREATE TABLE public.mdr_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  building_code text,
  status text NOT NULL CHECK (status IN ('success','partial','failed','aborted')),
  rows_inserted int NOT NULL DEFAULT 0,
  rows_skipped int NOT NULL DEFAULT 0,
  user_decisions jsonb,
  error_summary text,
  imported_by uuid REFERENCES auth.users(id),
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mdr_import_logs_imported_at ON public.mdr_import_logs(imported_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_import_logs TO authenticated;
GRANT ALL ON public.mdr_import_logs TO service_role;
ALTER TABLE public.mdr_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_import_logs admin/pm all" ON public.mdr_import_logs
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_mdr_buildings_updated BEFORE UPDATE ON public.mdr_buildings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mdr_drawings_updated BEFORE UPDATE ON public.mdr_drawings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mdr_progress_updated BEFORE UPDATE ON public.mdr_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mdr_weights_updated BEFORE UPDATE ON public.mdr_weights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
