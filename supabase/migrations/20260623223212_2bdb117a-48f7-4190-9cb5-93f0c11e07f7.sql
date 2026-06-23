ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS raw_row_cells jsonb;

COMMENT ON COLUMN public.mdr_drawings.raw_row_cells IS
  '엑셀 원본 행의 셀 값(헤더→값). 동일 양식 재내보내기 보조';