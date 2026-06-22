
-- 1) item_no를 비고유 표시 컬럼으로 강등
ALTER TABLE public.mdr_drawings ALTER COLUMN item_no DROP NOT NULL;

-- 2) 기존 (building_code, item_no) UNIQUE 제거
ALTER TABLE public.mdr_drawings DROP CONSTRAINT IF EXISTS mdr_drawings_building_code_item_no_key;

-- 3) doc_base 기반 부분 UNIQUE 인덱스 추가 (TBD/null 행은 공존 허용)
CREATE UNIQUE INDEX IF NOT EXISTS mdr_drawings_building_doc_base_uidx
  ON public.mdr_drawings (building_code, doc_base)
  WHERE doc_base IS NOT NULL;

-- 4) item_no 조회 성능 유지용 일반 인덱스
CREATE INDEX IF NOT EXISTS mdr_drawings_building_item_no_idx
  ON public.mdr_drawings (building_code, item_no);
