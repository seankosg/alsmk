
CREATE OR REPLACE FUNCTION public.sync_stage_plan_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drawing uuid := COALESCE(NEW.drawing_id, OLD.drawing_id);
  v_stage   text := COALESCE(NEW.stage, OLD.stage);
  v_date    date;
BEGIN
  IF v_drawing IS NULL OR v_stage IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT MIN(plan_date) INTO v_date
  FROM public.mdr_milestone_cells
  WHERE drawing_id = v_drawing AND stage = v_stage AND pct = 100;

  IF v_stage = 'SD' THEN
    UPDATE public.mdr_drawings SET stage_plan_sd = v_date
    WHERE id = v_drawing AND stage_plan_sd IS DISTINCT FROM v_date;
  ELSIF v_stage = 'DD' THEN
    UPDATE public.mdr_drawings SET stage_plan_dd = v_date
    WHERE id = v_drawing AND stage_plan_dd IS DISTINCT FROM v_date;
  ELSIF v_stage = 'CD' THEN
    UPDATE public.mdr_drawings SET stage_plan_cd = v_date
    WHERE id = v_drawing AND stage_plan_cd IS DISTINCT FROM v_date;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stage_plan_date ON public.mdr_milestone_cells;
CREATE TRIGGER trg_sync_stage_plan_date
AFTER INSERT OR UPDATE OR DELETE ON public.mdr_milestone_cells
FOR EACH ROW EXECUTE FUNCTION public.sync_stage_plan_date();
