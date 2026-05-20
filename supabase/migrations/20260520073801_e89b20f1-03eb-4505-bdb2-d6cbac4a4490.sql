
-- 1) Partial unique index: only active (non-deleted) task_codes must be unique
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_code_key;
DROP INDEX IF EXISTS public.tasks_task_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_code_active
  ON public.tasks (task_code)
  WHERE deleted_at IS NULL AND task_code IS NOT NULL;

-- 2) generate_task_code: exclude soft-deleted siblings from subtask numbering
CREATE OR REPLACE FUNCTION public.generate_task_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_code TEXT;
  v_part_code TEXT;
  v_yymm TEXT;
  v_seq INTEGER;
  v_parent_code TEXT;
  v_sub_count INTEGER;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT task_code INTO v_parent_code FROM public.tasks WHERE id = NEW.parent_id;
    IF v_parent_code IS NOT NULL THEN
      SELECT count(*) INTO v_sub_count
      FROM public.tasks
      WHERE parent_id = NEW.parent_id
        AND id != NEW.id
        AND deleted_at IS NULL;
      NEW.task_code := v_parent_code || '-' || lpad((v_sub_count + 1)::TEXT, 2, '0');
      RETURN NEW;
    END IF;
  END IF;

  SELECT code INTO v_team_code FROM public.teams WHERE id = NEW.team_id;

  IF NEW.part_id IS NOT NULL THEN
    SELECT code INTO v_part_code FROM public.parts WHERE id = NEW.part_id;
  ELSE
    v_part_code := 'GEN';
  END IF;

  v_yymm := to_char(now(), 'YYMM');

  INSERT INTO public.task_code_sequences (team_code, part_code, yymm, seq)
  VALUES (v_team_code, v_part_code, v_yymm, 1)
  ON CONFLICT (team_code, part_code, yymm)
  DO UPDATE SET seq = public.task_code_sequences.seq + 1
  RETURNING seq INTO v_seq;

  NEW.task_code := v_team_code || '-' || v_part_code || '-' || v_yymm || '-' || lpad(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

-- 3) update_summary_progress: only aggregate active subtasks; preserve summary when none remain
CREATE OR REPLACE FUNCTION public.update_summary_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_id UUID;
  v_avg INTEGER;
  v_min_start DATE;
  v_max_end DATE;
  v_active_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.parent_id;
  ELSE
    v_parent_id := NEW.parent_id;
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id AND OLD.parent_id IS NOT NULL THEN
      SELECT count(*) INTO v_active_count
      FROM public.tasks WHERE parent_id = OLD.parent_id AND deleted_at IS NULL;
      IF v_active_count > 0 THEN
        SELECT COALESCE(ROUND(
          SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
          / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
        ), 0)::INTEGER, MIN(start_date), MAX(end_date)
        INTO v_avg, v_min_start, v_max_end
        FROM public.tasks WHERE parent_id = OLD.parent_id AND deleted_at IS NULL;
        IF v_min_start IS NOT NULL THEN
          UPDATE public.tasks
          SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
          WHERE id = OLD.parent_id AND is_summary = true;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_parent_id IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM public.tasks WHERE parent_id = v_parent_id AND deleted_at IS NULL;
    -- Skip recalculation when no active subtasks remain (preserve summary values for restore)
    IF v_active_count > 0 THEN
      SELECT COALESCE(ROUND(
        SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
        / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
      ), 0)::INTEGER, MIN(start_date), MAX(end_date)
      INTO v_avg, v_min_start, v_max_end
      FROM public.tasks WHERE parent_id = v_parent_id AND deleted_at IS NULL;
      IF v_min_start IS NOT NULL THEN
        UPDATE public.tasks
        SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
        WHERE id = v_parent_id AND is_summary = true;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Trigger: also fire on deleted_at changes so soft delete/restore recompute correctly
DROP TRIGGER IF EXISTS trg_update_summary_progress ON public.tasks;
CREATE TRIGGER trg_update_summary_progress
AFTER INSERT OR UPDATE OF current_progress, parent_id, start_date, end_date, deleted_at OR DELETE
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_summary_progress();

-- 4) add_subtask RPC: atomic summary conversion + clone + insert + resequence
CREATE OR REPLACE FUNCTION public.add_subtask(
  _parent_id uuid,
  _title text,
  _category text,
  _team_id uuid,
  _assignee_id uuid,
  _start_date date,
  _end_date date,
  _action_plan text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.tasks%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_parent FROM public.tasks WHERE id = _parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent task not found';
  END IF;

  -- Step 1: Convert parent to summary + clone original as first subtask
  IF NOT v_parent.is_summary THEN
    UPDATE public.tasks SET
      is_summary = true,
      action_plan = NULL,
      current_progress = 0,
      actual_finish = NULL,
      issue_flag = 'normal'::issue_flag,
      issue_type = NULL,
      issue_description = NULL
    WHERE id = _parent_id;

    INSERT INTO public.tasks (
      parent_id, title, category, team_id, part_id, assignee_id,
      start_date, end_date, action_plan, current_progress, actual_finish,
      issue_flag, issue_type, issue_description, milestone_id, created_by, is_summary
    ) VALUES (
      _parent_id, v_parent.title, v_parent.category, v_parent.team_id, v_parent.part_id, v_parent.assignee_id,
      v_parent.start_date, v_parent.end_date, v_parent.action_plan, v_parent.current_progress, v_parent.actual_finish,
      v_parent.issue_flag, v_parent.issue_type, v_parent.issue_description, v_parent.milestone_id, v_parent.created_by, false
    );
  END IF;

  -- Step 2: Insert new subtask
  INSERT INTO public.tasks (
    parent_id, title, category, team_id, part_id, assignee_id,
    start_date, end_date, action_plan, milestone_id, created_by, is_summary
  ) VALUES (
    _parent_id, _title, _category, _team_id, v_parent.part_id, _assignee_id,
    _start_date, _end_date, _action_plan, v_parent.milestone_id, v_parent.created_by, false
  ) RETURNING id INTO v_new_id;

  -- Step 3: Resequence sibling codes
  PERFORM public.resequence_subtask_codes(_parent_id);

  RETURN v_new_id;
END;
$$;
