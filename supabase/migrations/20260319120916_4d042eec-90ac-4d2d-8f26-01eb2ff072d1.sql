
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
  -- If subtask (has parent_id), generate hierarchical code
  IF NEW.parent_id IS NOT NULL THEN
    SELECT task_code INTO v_parent_code FROM public.tasks WHERE id = NEW.parent_id;
    IF v_parent_code IS NOT NULL THEN
      SELECT count(*) INTO v_sub_count FROM public.tasks WHERE parent_id = NEW.parent_id AND id != NEW.id;
      NEW.task_code := v_parent_code || '-' || lpad((v_sub_count + 1)::TEXT, 2, '0');
      RETURN NEW;
    END IF;
  END IF;

  -- Standard code generation for summary/independent tasks
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

DROP TRIGGER IF EXISTS trg_generate_task_code ON public.tasks;
CREATE TRIGGER trg_generate_task_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_task_code();
