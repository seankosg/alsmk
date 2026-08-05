CREATE OR REPLACE FUNCTION public.generate_task_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_code TEXT;
  v_part_code TEXT;
  v_yymm TEXT;
  v_seq INTEGER;
  v_parent_code TEXT;
  v_next INTEGER;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT task_code INTO v_parent_code FROM public.tasks WHERE id = NEW.parent_id;
    IF v_parent_code IS NOT NULL THEN
      SELECT COALESCE(
        MAX(
          NULLIF(
            regexp_replace(task_code, '^' || regexp_replace(v_parent_code, '([\\.\\+\\*\\?\\(\\)\\[\\]\\{\\}\\|\\^\\$])', '\\\\\\1', 'g') || '-', ''),
            ''
          )::int
        ),
        0
      ) + 1
      INTO v_next
      FROM public.tasks
      WHERE parent_id = NEW.parent_id
        AND id != NEW.id
        AND deleted_at IS NULL
        AND task_code ~ ('^' || regexp_replace(v_parent_code, '([\\.\\+\\*\\?\\(\\)\\[\\]\\{\\}\\|\\^\\$])', '\\\\\\1', 'g') || '-[0-9]+$');

      NEW.task_code := v_parent_code || '-' || lpad(v_next::TEXT, 2, '0');
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