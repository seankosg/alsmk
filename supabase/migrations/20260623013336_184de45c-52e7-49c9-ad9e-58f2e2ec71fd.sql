DROP FUNCTION IF EXISTS public.get_mdr_import_row_logs(uuid);

CREATE OR REPLACE FUNCTION public.get_mdr_import_row_logs(_import_log_id uuid)
RETURNS TABLE (
  id uuid,
  source_sheet text,
  raw_row_no integer,
  item_no text,
  source_no text,
  drawing_title text,
  doc_base text,
  rev text,
  action text,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, source_sheet, raw_row_no, item_no, source_no, drawing_title, doc_base, rev, action, reason
  FROM public.mdr_import_row_logs
  WHERE import_log_id = _import_log_id
  ORDER BY source_sheet ASC NULLS LAST, raw_row_no ASC NULLS LAST, id ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_mdr_import_row_logs(uuid) TO authenticated, service_role;