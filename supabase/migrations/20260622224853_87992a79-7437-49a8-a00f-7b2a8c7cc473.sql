-- 1) mdr_drawings: doc_base NOT NULL + 전체 UNIQUE
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_unique;
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_uidx;
DROP INDEX IF EXISTS public.idx_mdr_drawings_building_doc_base;
DROP INDEX IF EXISTS public.mdr_drawings_building_item_no_uidx;
DROP INDEX IF EXISTS public.mdr_drawings_building_item_no_idx;
ALTER TABLE public.mdr_drawings DROP CONSTRAINT IF EXISTS mdr_drawings_building_code_item_no_key;

ALTER TABLE public.mdr_drawings ALTER COLUMN doc_base SET NOT NULL;

CREATE UNIQUE INDEX mdr_drawings_building_doc_base_uidx
  ON public.mdr_drawings (building_code, doc_base);

CREATE INDEX mdr_drawings_building_item_no_idx
  ON public.mdr_drawings (building_code, item_no);

-- 2) 누락 토큰 플래그
ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS missing_plant_id boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_pbs      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_fbs      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_ser_no   boolean NOT NULL DEFAULT false;

-- 3) 이력 테이블 강화
ALTER TABLE public.mdr_drawing_revisions ALTER COLUMN doc_base SET NOT NULL;
CREATE INDEX IF NOT EXISTS mdr_drawing_revisions_bldg_docbase_rev_idx
  ON public.mdr_drawing_revisions (building_code, doc_base, rev);

-- 4) 행 로그에 doc_base 추가
ALTER TABLE public.mdr_import_row_logs
  ADD COLUMN IF NOT EXISTS doc_base text;
