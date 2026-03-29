
-- Atomic mapping update: Activity → Task[] (used by MapTasksDialog)
CREATE OR REPLACE FUNCTION public.upsert_activity_mappings(
  _activity_id uuid,
  _task_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete existing mappings for this activity
  DELETE FROM public.cpm_task_mappings WHERE activity_id = _activity_id;
  
  -- Insert new mappings
  IF array_length(_task_ids, 1) IS NOT NULL THEN
    INSERT INTO public.cpm_task_mappings (activity_id, task_id)
    SELECT _activity_id, unnest(_task_ids);
  END IF;
END;
$$;

-- Atomic mapping update: Task → Activity[] (used by MapActivitiesDialog)
CREATE OR REPLACE FUNCTION public.upsert_task_mappings(
  _task_id uuid,
  _activity_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete existing mappings for this task
  DELETE FROM public.cpm_task_mappings WHERE task_id = _task_id;
  
  -- Insert new mappings
  IF array_length(_activity_ids, 1) IS NOT NULL THEN
    INSERT INTO public.cpm_task_mappings (activity_id, task_id)
    SELECT unnest(_activity_ids), _task_id;
  END IF;
END;
$$;
