CREATE TABLE public.project_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to project_settings" ON public.project_settings FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO public.project_settings (key, value) VALUES ('pm_name', 'TBD');