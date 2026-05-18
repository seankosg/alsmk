CREATE OR REPLACE FUNCTION public.resequence_subtask_codes(_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_code TEXT;
  v_sib RECORD;
  v_idx INTEGER := 0;
  v_tmp_suffix TEXT := to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6);
BEGIN
  SELECT task_code INTO v_parent_code FROM public.tasks WHERE id = _parent_id;
  IF v_parent_code IS NULL THEN
    RETURN;
  END IF;

  -- Pass 1: assign temporary unique codes to all siblings to avoid UNIQUE conflicts
  FOR v_sib IN
    SELECT id FROM public.tasks
    WHERE parent_id = _parent_id AND deleted_at IS NULL
    ORDER BY start_date ASC NULLS LAST, created_at ASC
  LOOP
    v_idx := v_idx + 1;
    UPDATE public.tasks
    SET task_code = v_parent_code || '-TMP-' || v_tmp_suffix || '-' || v_idx::text
    WHERE id = v_sib.id;
  END LOOP;

  -- Pass 2: assign final sequential codes
  v_idx := 0;
  FOR v_sib IN
    SELECT id FROM public.tasks
    WHERE parent_id = _parent_id AND deleted_at IS NULL
    ORDER BY start_date ASC NULLS LAST, created_at ASC
  LOOP
    v_idx := v_idx + 1;
    UPDATE public.tasks
    SET task_code = v_parent_code || '-' || lpad(v_idx::text, 2, '0')
    WHERE id = v_sib.id;
  END LOOP;
END;
$$;