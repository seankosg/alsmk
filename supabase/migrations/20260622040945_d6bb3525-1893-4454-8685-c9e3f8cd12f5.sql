
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_unique;
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_uidx;
DROP INDEX IF EXISTS public.mdr_drawings_building_item_no_idx;

CREATE UNIQUE INDEX mdr_drawings_building_item_no_uidx
  ON public.mdr_drawings (building_code, item_no);

CREATE INDEX IF NOT EXISTS idx_mdr_drawings_building_doc_base
  ON public.mdr_drawings (building_code, doc_base)
  WHERE doc_base IS NOT NULL;

DELETE FROM public.mdr_drawings WHERE building_code = 'GEN';
