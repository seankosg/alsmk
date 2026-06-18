
-- ============== activity_log ==============
DROP POLICY IF EXISTS "Allow all access to activity_log" ON public.activity_log;
REVOKE ALL ON public.activity_log FROM anon;
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
CREATE POLICY "Admins can read activity_log" ON public.activity_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============== conversations ==============
DROP POLICY IF EXISTS "Authenticated can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT TO authenticated USING (is_conversation_member(id, auth.uid()));

-- ============== data_backups ==============
DROP POLICY IF EXISTS "Authenticated can view backups" ON public.data_backups;
CREATE POLICY "Admins can view backups" ON public.data_backups
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============== issue_threads ==============
DROP POLICY IF EXISTS "Allow all access to issue_threads" ON public.issue_threads;
REVOKE ALL ON public.issue_threads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_threads TO authenticated;
GRANT ALL ON public.issue_threads TO service_role;
CREATE POLICY "Authenticated can manage issue_threads" ON public.issue_threads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============== members ==============
DROP POLICY IF EXISTS "Allow all access to members" ON public.members;
REVOKE ALL ON public.members FROM anon;
GRANT SELECT ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
CREATE POLICY "Authenticated can view members" ON public.members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert members" ON public.members
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Self or admin can update members" ON public.members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete members" ON public.members
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============== personnel_targets ==============
DROP POLICY IF EXISTS "Allow all access to personnel_targets" ON public.personnel_targets;
REVOKE ALL ON public.personnel_targets FROM anon;
GRANT SELECT ON public.personnel_targets TO authenticated;
GRANT ALL ON public.personnel_targets TO service_role;
CREATE POLICY "Authenticated can view personnel_targets" ON public.personnel_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage personnel_targets" ON public.personnel_targets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============== project_settings ==============
DROP POLICY IF EXISTS "Allow all access to project_settings" ON public.project_settings;
REVOKE ALL ON public.project_settings FROM anon;
GRANT SELECT ON public.project_settings TO authenticated;
GRANT ALL ON public.project_settings TO service_role;
CREATE POLICY "Authenticated can view project_settings" ON public.project_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage project_settings" ON public.project_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============== task_code_sequences (server-only, used by SECURITY DEFINER trigger) ==============
DROP POLICY IF EXISTS "Allow all access to task_code_sequences" ON public.task_code_sequences;
REVOKE ALL ON public.task_code_sequences FROM anon, authenticated;
GRANT ALL ON public.task_code_sequences TO service_role;
-- RLS stays enabled; no policy = no access from anon/authenticated. SECURITY DEFINER functions bypass RLS.

-- ============== tasks ==============
DROP POLICY IF EXISTS "Allow all access to tasks" ON public.tasks;
REVOKE ALL ON public.tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
CREATE POLICY "Authenticated can manage tasks" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============== teams ==============
DROP POLICY IF EXISTS "Allow all access to teams" ON public.teams;
REVOKE ALL ON public.teams FROM anon;
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
CREATE POLICY "Authenticated can view teams" ON public.teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============== parts ==============
DROP POLICY IF EXISTS "Allow all access to parts" ON public.parts;
REVOKE ALL ON public.parts FROM anon;
GRANT SELECT ON public.parts TO authenticated;
GRANT ALL ON public.parts TO service_role;
CREATE POLICY "Authenticated can view parts" ON public.parts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage parts" ON public.parts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============== milestones ==============
DROP POLICY IF EXISTS "Allow all access to milestones" ON public.milestones;
REVOKE ALL ON public.milestones FROM anon;
GRANT SELECT ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
CREATE POLICY "Authenticated can view milestones" ON public.milestones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage milestones" ON public.milestones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
