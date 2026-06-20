
CREATE TABLE public.mdr_summary_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_filename TEXT,
  block_code TEXT NOT NULL,
  discipline TEXT NOT NULL,
  sd_plan INTEGER DEFAULT 0,
  sd_actual INTEGER DEFAULT 0,
  dd_plan INTEGER DEFAULT 0,
  dd_actual INTEGER DEFAULT 0,
  cd_plan INTEGER DEFAULT 0,
  cd_actual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, block_code, discipline)
);

CREATE INDEX idx_mdr_summary_matrix_date ON public.mdr_summary_matrix (snapshot_date DESC);
CREATE INDEX idx_mdr_summary_matrix_block ON public.mdr_summary_matrix (block_code);

GRANT SELECT ON public.mdr_summary_matrix TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mdr_summary_matrix TO authenticated;
GRANT ALL ON public.mdr_summary_matrix TO service_role;

ALTER TABLE public.mdr_summary_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mdr_summary_matrix read all"
  ON public.mdr_summary_matrix FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "mdr_summary_matrix admin/pm write"
  ON public.mdr_summary_matrix FOR ALL
  TO authenticated
  USING (public.is_admin_or_pm(auth.uid()))
  WITH CHECK (public.is_admin_or_pm(auth.uid()));

CREATE TRIGGER trg_mdr_summary_matrix_updated
  BEFORE UPDATE ON public.mdr_summary_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
