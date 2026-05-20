
-- A. generate_task_code: subtask 분기에서 안전한 번호 산정
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
  v_next INTEGER;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT task_code INTO v_parent_code FROM public.tasks WHERE id = NEW.parent_id;
    IF v_parent_code IS NOT NULL THEN
      -- 활성 형제 중 동일 prefix를 가진 코드의 최대 suffix + 1
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

-- B. restore_task RPC: 복원 시 코드 충돌 자동 회피
CREATE OR REPLACE FUNCTION public.restore_task(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_id uuid;
  v_task_code text;
  v_team_id uuid;
  v_part_id uuid;
  v_team_code text;
  v_part_code text;
  v_yymm text;
  v_seq integer;
  v_conflict boolean;
  v_tmp text;
BEGIN
  SELECT parent_id, task_code, team_id, part_id
  INTO v_parent_id, v_task_code, v_team_id, v_part_id
  FROM public.tasks
  WHERE id = _id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- 활성 상태로 같은 코드를 쓰는 다른 행이 있는지 확인
  SELECT EXISTS(
    SELECT 1 FROM public.tasks
    WHERE task_code = v_task_code
      AND deleted_at IS NULL
      AND id != _id
  ) INTO v_conflict;

  IF v_conflict THEN
    -- 임시 코드로 우선 변경 (deleted 상태라 부분 unique index 영향 없음)
    v_tmp := COALESCE(v_task_code, 'RESTORE') || '-RESTORE-' ||
             to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' ||
             substr(md5(random()::text), 1, 6);
    UPDATE public.tasks SET task_code = v_tmp WHERE id = _id;
  END IF;

  -- 복원
  UPDATE public.tasks
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = _id;

  IF v_parent_id IS NOT NULL THEN
    -- 서브태스크: 부모 그룹 재정렬 (TMP suffix 2-pass)
    PERFORM public.resequence_subtask_codes(v_parent_id);
  ELSIF v_conflict THEN
    -- 최상위 task인데 충돌이 있었다면 시퀀스에서 새 번호 발급
    SELECT code INTO v_team_code FROM public.teams WHERE id = v_team_id;
    IF v_part_id IS NOT NULL THEN
      SELECT code INTO v_part_code FROM public.parts WHERE id = v_part_id;
    ELSE
      v_part_code := 'GEN';
    END IF;
    v_yymm := to_char(now(), 'YYMM');

    INSERT INTO public.task_code_sequences (team_code, part_code, yymm, seq)
    VALUES (v_team_code, v_part_code, v_yymm, 1)
    ON CONFLICT (team_code, part_code, yymm)
    DO UPDATE SET seq = public.task_code_sequences.seq + 1
    RETURNING seq INTO v_seq;

    UPDATE public.tasks
    SET task_code = v_team_code || '-' || v_part_code || '-' || v_yymm || '-' || lpad(v_seq::TEXT, 4, '0')
    WHERE id = _id;
  END IF;
END;
$function$;
