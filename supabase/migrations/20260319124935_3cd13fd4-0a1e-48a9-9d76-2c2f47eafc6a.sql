
-- Function to recalculate summary task progress from subtasks
CREATE OR REPLACE FUNCTION public.update_summary_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id UUID;
  v_avg INTEGER;
BEGIN
  -- Determine the parent_id to update
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.parent_id;
  ELSE
    v_parent_id := NEW.parent_id;
    -- Also handle case where parent_id changed (subtask moved)
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id AND OLD.parent_id IS NOT NULL THEN
      -- Recalc old parent
      SELECT COALESCE(ROUND(AVG(current_progress)), 0)::INTEGER INTO v_avg
      FROM public.tasks WHERE parent_id = OLD.parent_id;
      UPDATE public.tasks SET current_progress = v_avg WHERE id = OLD.parent_id AND is_summary = true;
    END IF;
  END IF;

  -- Recalc current parent
  IF v_parent_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(current_progress)), 0)::INTEGER INTO v_avg
    FROM public.tasks WHERE parent_id = v_parent_id;
    UPDATE public.tasks SET current_progress = v_avg WHERE id = v_parent_id AND is_summary = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on tasks table for subtask changes
CREATE TRIGGER trg_update_summary_progress
AFTER INSERT OR UPDATE OF current_progress, parent_id OR DELETE
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_summary_progress();
