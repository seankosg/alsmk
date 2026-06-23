CREATE TABLE public.mdr_milestone_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES public.mdr_drawings(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('SD','DD','CD')),
  pct integer NOT NULL CHECK (pct BETWEEN 0 AND 100),
  sub_idx integer NOT NULL,
  increment_pct numeric(6,2) NOT NULL DEFAULT 0,
  plan_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drawing_id, stage, pct, sub_idx)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_milestone_cells TO authenticated;
GRANT ALL ON public.mdr_milestone_cells TO service_role;
ALTER TABLE public.mdr_milestone_cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_milestone_cells admin/pm all" ON public.mdr_milestone_cells
  TO authenticated USING (public.is_admin_or_pm(auth.uid())) WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE INDEX idx_mdr_milestone_cells_drawing ON public.mdr_milestone_cells(drawing_id);

-- 기존 그룹 단위 마일스톤을 sub_idx=0 단일 셀로 백필 (동치 보장)
INSERT INTO public.mdr_milestone_cells (drawing_id, stage, pct, sub_idx, increment_pct, plan_date)
SELECT drawing_id, stage, pct, 0, increment_pct, plan_date FROM public.mdr_milestones;

-- mdr_progress 를 셀 단위로 확장
ALTER TABLE public.mdr_progress ADD COLUMN IF NOT EXISTS sub_idx integer NOT NULL DEFAULT 0;
ALTER TABLE public.mdr_progress DROP CONSTRAINT IF EXISTS mdr_progress_drawing_id_stage_pct_key;
ALTER TABLE public.mdr_progress
  ADD CONSTRAINT mdr_progress_drawing_stage_pct_sub_key
  UNIQUE (drawing_id, stage, pct, sub_idx);
