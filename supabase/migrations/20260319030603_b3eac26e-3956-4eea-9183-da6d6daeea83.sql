
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  end_date date,
  event_type text NOT NULL DEFAULT 'personal',
  created_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Owner or admin can update events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (
    created_by IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner or admin can delete events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (
    created_by IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
