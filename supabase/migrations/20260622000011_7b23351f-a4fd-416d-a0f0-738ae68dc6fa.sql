ALTER TABLE public.mdr_drawings
  ADD COLUMN IF NOT EXISTS import_log_id uuid REFERENCES public.mdr_import_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mdr_drawings_import_log_id
  ON public.mdr_drawings(import_log_id);

-- 일회성 고아 도면 정리 (현재 모든 import_logs가 0건이므로 import_log_id IS NULL = 고아)
DELETE FROM public.mdr_drawings WHERE import_log_id IS NULL;