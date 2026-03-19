ALTER TABLE public.calendar_events
  ADD COLUMN all_day boolean NOT NULL DEFAULT true,
  ADD COLUMN start_time time without time zone,
  ADD COLUMN end_time time without time zone;