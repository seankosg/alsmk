
-- CPM Activities: stores XML-parsed activity metadata
CREATE TABLE public.cpm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mpp_uid TEXT,
  mpp_task_id TEXT,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  progress INTEGER,
  wbs_full TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  is_milestone BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  finish_date DATE,
  es INTEGER,
  ef INTEGER,
  ls INTEGER,
  lf INTEGER,
  tf INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CPM Task Mappings: many-to-many between activities and tasks
CREATE TABLE public.cpm_task_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.cpm_activities(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, task_id)
);

-- RLS
ALTER TABLE public.cpm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpm_task_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on cpm_activities"
  ON public.cpm_activities FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access on cpm_task_mappings"
  ON public.cpm_task_mappings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
