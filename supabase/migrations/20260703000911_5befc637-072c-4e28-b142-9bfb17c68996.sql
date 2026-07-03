
-- RFI 4 tables + recompute function
CREATE TABLE public.rfi_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfi_no text NOT NULL,
  raw_no int,
  raw_status text,
  from_party text,
  to_party text,
  direction text NOT NULL DEFAULT 'Unknown' CHECK (direction IN ('Outgoing','Incoming','Unknown')),
  event_type text NOT NULL DEFAULT 'Unknown' CHECK (event_type IN ('Send','Reply','Resend','Unknown')),
  title text,
  title_clean text,
  discipline text,
  originator text,
  issue_date date,
  due_date date,
  finish_date date,
  external_url text,
  import_log_id uuid,
  source_row_hash text NOT NULL UNIQUE,
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rfi_events_rfi_no_idx ON public.rfi_events(rfi_no);
CREATE INDEX rfi_events_issue_date_idx ON public.rfi_events(issue_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfi_events TO authenticated;
GRANT ALL ON public.rfi_events TO service_role;
ALTER TABLE public.rfi_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfi_events admin/pm all" ON public.rfi_events FOR ALL
  USING (public.is_admin_or_pm(auth.uid())) WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE TRIGGER rfi_events_upd BEFORE UPDATE ON public.rfi_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rfi_masters (
  rfi_no text NOT NULL PRIMARY KEY,
  direction text,
  discipline text,
  originator text,
  title text,
  issue_date date,
  due_date date,
  response_date date,
  finish_date date,
  status text CHECK (status IN ('Overdue','DueSoon','OnTrack','Closed','LateClosed','Info')),
  event_count int NOT NULL DEFAULT 0,
  last_event_at date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rfi_masters_status_idx ON public.rfi_masters(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfi_masters TO authenticated;
GRANT ALL ON public.rfi_masters TO service_role;
ALTER TABLE public.rfi_masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfi_masters admin/pm all" ON public.rfi_masters FOR ALL
  USING (public.is_admin_or_pm(auth.uid())) WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE TRIGGER rfi_masters_upd BEFORE UPDATE ON public.rfi_masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rfi_import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename text,
  uploaded_by uuid,
  rows_total int NOT NULL DEFAULT 0,
  rows_inserted int NOT NULL DEFAULT 0,
  rows_skipped int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_summary text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfi_import_logs TO authenticated;
GRANT ALL ON public.rfi_import_logs TO service_role;
ALTER TABLE public.rfi_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfi_import_logs admin/pm all" ON public.rfi_import_logs FOR ALL
  USING (public.is_admin_or_pm(auth.uid())) WITH CHECK (public.is_admin_or_pm(auth.uid()));

CREATE TABLE public.rfi_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfi_no text NOT NULL,
  event_id uuid,
  dm_id uuid,
  sent_by uuid,
  days_overdue int,
  subject text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rfi_reminders_rfi_no_idx ON public.rfi_reminders(rfi_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfi_reminders TO authenticated;
GRANT ALL ON public.rfi_reminders TO service_role;
ALTER TABLE public.rfi_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfi_reminders admin/pm all" ON public.rfi_reminders FOR ALL
  USING (public.is_admin_or_pm(auth.uid())) WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- Recompute master from events for a single rfi_no
CREATE OR REPLACE FUNCTION public.recompute_rfi_master(_rfi_no text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_direction text;
  v_discipline text;
  v_originator text;
  v_title text;
  v_issue_date date;
  v_due_date date;
  v_response_date date;
  v_finish_date date;
  v_status text;
  v_event_count int;
  v_last_event_at date;
  v_has_out boolean;
  v_today date := current_date;
  v_diff int;
BEGIN
  SELECT count(*) INTO v_event_count FROM public.rfi_events WHERE rfi_no = _rfi_no;
  IF v_event_count = 0 THEN
    DELETE FROM public.rfi_masters WHERE rfi_no = _rfi_no;
    RETURN;
  END IF;

  SELECT bool_or(direction = 'Outgoing') INTO v_has_out FROM public.rfi_events WHERE rfi_no = _rfi_no;

  -- 최초 Outgoing 발송건 기준
  IF v_has_out THEN
    SELECT direction, discipline, originator, title_clean, issue_date, due_date
      INTO v_direction, v_discipline, v_originator, v_title, v_issue_date, v_due_date
    FROM public.rfi_events
    WHERE rfi_no = _rfi_no AND direction = 'Outgoing'
    ORDER BY issue_date ASC NULLS LAST, created_at ASC
    LIMIT 1;
  ELSE
    SELECT direction, discipline, originator, title_clean, issue_date, due_date
      INTO v_direction, v_discipline, v_originator, v_title, v_issue_date, v_due_date
    FROM public.rfi_events
    WHERE rfi_no = _rfi_no
    ORDER BY issue_date ASC NULLS LAST, created_at ASC
    LIMIT 1;
  END IF;

  -- 회신일: Incoming Reply 중 가장 이른 것
  SELECT MIN(issue_date) INTO v_response_date
  FROM public.rfi_events
  WHERE rfi_no = _rfi_no AND direction = 'Incoming';

  -- 최종 finish/마지막 이벤트
  SELECT MAX(finish_date), MAX(COALESCE(issue_date, finish_date))
    INTO v_finish_date, v_last_event_at
  FROM public.rfi_events
  WHERE rfi_no = _rfi_no;

  -- status
  IF v_direction <> 'Outgoing' OR v_due_date IS NULL THEN
    v_status := 'Info';
  ELSIF v_response_date IS NOT NULL OR v_finish_date IS NOT NULL THEN
    IF v_finish_date IS NOT NULL AND v_due_date IS NOT NULL AND v_finish_date > v_due_date THEN
      v_status := 'LateClosed';
    ELSE
      v_status := 'Closed';
    END IF;
  ELSE
    v_diff := (v_due_date - v_today);
    IF v_diff < 0 THEN v_status := 'Overdue';
    ELSIF v_diff <= 3 THEN v_status := 'DueSoon';
    ELSE v_status := 'OnTrack';
    END IF;
  END IF;

  INSERT INTO public.rfi_masters(rfi_no, direction, discipline, originator, title, issue_date, due_date, response_date, finish_date, status, event_count, last_event_at, updated_at)
  VALUES (_rfi_no, v_direction, v_discipline, v_originator, v_title, v_issue_date, v_due_date, v_response_date, v_finish_date, v_status, v_event_count, v_last_event_at, now())
  ON CONFLICT (rfi_no) DO UPDATE SET
    direction=EXCLUDED.direction, discipline=EXCLUDED.discipline, originator=EXCLUDED.originator,
    title=EXCLUDED.title, issue_date=EXCLUDED.issue_date, due_date=EXCLUDED.due_date,
    response_date=EXCLUDED.response_date, finish_date=EXCLUDED.finish_date,
    status=EXCLUDED.status, event_count=EXCLUDED.event_count, last_event_at=EXCLUDED.last_event_at,
    updated_at=now();
END;
$$;
