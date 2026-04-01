CREATE OR REPLACE FUNCTION public.update_summary_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_parent_id UUID;
  v_avg INTEGER;
  v_min_start DATE;
  v_max_end DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.parent_id;
  ELSE
    v_parent_id := NEW.parent_id;
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id AND OLD.parent_id IS NOT NULL THEN
      SELECT COALESCE(ROUND(
        SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
        / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
      ), 0)::INTEGER, MIN(start_date), MAX(end_date)
      INTO v_avg, v_min_start, v_max_end
      FROM public.tasks WHERE parent_id = OLD.parent_id AND deleted_at IS NULL;
      IF v_min_start IS NOT NULL THEN
        UPDATE public.tasks SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
        WHERE id = OLD.parent_id AND is_summary = true;
      END IF;
    END IF;
  END IF;

  IF v_parent_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(
      SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
      / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
    ), 0)::INTEGER, MIN(start_date), MAX(end_date)
    INTO v_avg, v_min_start, v_max_end
    FROM public.tasks WHERE parent_id = v_parent_id AND deleted_at IS NULL;
    IF v_min_start IS NOT NULL THEN
      UPDATE public.tasks SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
      WHERE id = v_parent_id AND is_summary = true;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;