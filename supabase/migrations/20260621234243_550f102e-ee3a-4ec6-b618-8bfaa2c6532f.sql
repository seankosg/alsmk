
-- 1. mdr_drawings 컬럼 추가
ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS rev TEXT NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS doc_base TEXT,
  ADD COLUMN IF NOT EXISTS doc_no TEXT;

-- 동일 건물 내 doc_base 유니크 (doc_base가 있는 행만)
CREATE UNIQUE INDEX IF NOT EXISTS mdr_drawings_building_doc_base_unique
  ON public.mdr_drawings (building_code, doc_base)
  WHERE doc_base IS NOT NULL;

-- 2. 리비전 이력 테이블
CREATE TABLE IF NOT EXISTS public.mdr_drawing_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES public.mdr_drawings(id) ON DELETE CASCADE,
  building_code TEXT NOT NULL,
  doc_base TEXT,
  doc_no TEXT,
  rev TEXT NOT NULL,
  drawing_title TEXT,
  plan_finish DATE,
  actual_finish DATE,
  out_of_scope BOOLEAN DEFAULT false,
  progress_snapshot JSONB,
  source_sheet TEXT,
  import_log_id UUID REFERENCES public.mdr_import_logs(id) ON DELETE SET NULL,
  superseded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by_rev TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mdr_drawing_revisions_drawing_idx
  ON public.mdr_drawing_revisions (drawing_id, superseded_at DESC);
CREATE INDEX IF NOT EXISTS mdr_drawing_revisions_base_idx
  ON public.mdr_drawing_revisions (building_code, doc_base);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_drawing_revisions TO authenticated;
GRANT ALL ON public.mdr_drawing_revisions TO service_role;

ALTER TABLE public.mdr_drawing_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read revisions"
  ON public.mdr_drawing_revisions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin or pm manage revisions"
  ON public.mdr_drawing_revisions FOR ALL
  TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));
