
-- =============================================
-- ALSMK Construction Project Management Schema
-- =============================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');
CREATE TYPE public.milestone_status AS ENUM ('upcoming', 'in_progress', 'completed', 'delayed');
CREATE TYPE public.issue_flag AS ENUM ('normal', 'warning', 'critical');

-- Teams
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parts
CREATE TABLE public.parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, code)
);

-- Members
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  duty_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles (separate table per security guidelines)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Milestones
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_date DATE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status milestone_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Code Sequences (for atomic code generation)
CREATE TABLE public.task_code_sequences (
  team_code TEXT NOT NULL,
  part_code TEXT NOT NULL,
  yymm TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (team_code, part_code, yymm)
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_code TEXT UNIQUE,
  title TEXT NOT NULL,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  current_progress INTEGER NOT NULL DEFAULT 0 CHECK (current_progress BETWEEN 0 AND 100),
  issue_flag issue_flag NOT NULL DEFAULT 'normal',
  issue_type TEXT,
  issue_description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issue Threads
CREATE TABLE public.issue_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Log
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personnel Targets
CREATE TABLE public.personnel_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
  target_headcount INTEGER NOT NULL DEFAULT 0,
  current_headcount INTEGER NOT NULL DEFAULT 0
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX idx_tasks_issue_flag ON public.tasks(issue_flag);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_milestone_id ON public.tasks(milestone_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX idx_parts_team_id ON public.parts(team_id);
CREATE INDEX idx_members_team_id ON public.members(team_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Task Code Generator Trigger
CREATE OR REPLACE FUNCTION public.generate_task_code()
RETURNS TRIGGER AS $$
DECLARE
  v_team_code TEXT;
  v_part_code TEXT;
  v_yymm TEXT;
  v_seq INTEGER;
BEGIN
  -- Get team code
  SELECT code INTO v_team_code FROM public.teams WHERE id = NEW.team_id;
  
  -- Get part code (default 'GEN' if no part)
  IF NEW.part_id IS NOT NULL THEN
    SELECT code INTO v_part_code FROM public.parts WHERE id = NEW.part_id;
  ELSE
    v_part_code := 'GEN';
  END IF;
  
  -- Current YYMM
  v_yymm := to_char(now(), 'YYMM');
  
  -- Atomically increment sequence
  INSERT INTO public.task_code_sequences (team_code, part_code, yymm, seq)
  VALUES (v_team_code, v_part_code, v_yymm, 1)
  ON CONFLICT (team_code, part_code, yymm)
  DO UPDATE SET seq = public.task_code_sequences.seq + 1
  RETURNING seq INTO v_seq;
  
  -- Set the task code
  NEW.task_code := v_team_code || '-' || v_part_code || '-' || v_yymm || '-' || lpad(v_seq::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_task_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  WHEN (NEW.task_code IS NULL)
  EXECUTE FUNCTION public.generate_task_code();

-- =============================================
-- RLS (Dev mode: permissive for authenticated & anon)
-- =============================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_code_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_targets ENABLE ROW LEVEL SECURITY;

-- Dev mode: allow all access (to be tightened for production)
CREATE POLICY "Allow all access to teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to parts" ON public.parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to milestones" ON public.milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to task_code_sequences" ON public.task_code_sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to issue_threads" ON public.issue_threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to activity_log" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to personnel_targets" ON public.personnel_targets FOR ALL USING (true) WITH CHECK (true);

-- User roles: only admins can manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
