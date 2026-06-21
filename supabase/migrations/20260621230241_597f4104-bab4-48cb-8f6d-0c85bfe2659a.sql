CREATE TABLE public.mdr_import_row_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_log_id uuid NOT NULL REFERENCES public.mdr_import_logs(id) ON DELETE CASCADE,
  source_sheet text,
  raw_row_no int,
  item_no text,
  source_no text,
  drawing_title text,
  action text NOT NULL CHECK (action IN ('inserted','skipped_duplicate','skipped_existing')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mdr_import_row_logs_log_action ON public.mdr_import_row_logs(import_log_id, action);
CREATE INDEX idx_mdr_import_row_logs_log_row ON public.mdr_import_row_logs(import_log_id, raw_row_no);
GRANT SELECT, INSERT ON public.mdr_import_row_logs TO authenticated;
GRANT ALL ON public.mdr_import_row_logs TO service_role;
ALTER TABLE public.mdr_import_row_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_import_row_logs admin/pm all" ON public.mdr_import_row_logs
  FOR ALL TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));