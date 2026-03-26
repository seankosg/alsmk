
-- Create a security definer function to check admin or PM status
CREATE OR REPLACE FUNCTION public.is_admin_or_pm(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.members WHERE user_id = _user_id AND is_pm = true
  )
$$;

-- Drop existing permissive policies on cpm_snapshots
DROP POLICY IF EXISTS "Authenticated can insert snapshots" ON public.cpm_snapshots;
DROP POLICY IF EXISTS "Authenticated can update snapshots" ON public.cpm_snapshots;
DROP POLICY IF EXISTS "Authenticated can delete snapshots" ON public.cpm_snapshots;
DROP POLICY IF EXISTS "Authenticated can read snapshots" ON public.cpm_snapshots;

-- Read: all authenticated users
CREATE POLICY "Authenticated can read snapshots"
ON public.cpm_snapshots FOR SELECT
TO authenticated
USING (true);

-- Insert: admin or PM only
CREATE POLICY "Admin or PM can insert snapshots"
ON public.cpm_snapshots FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- Update: admin or PM only
CREATE POLICY "Admin or PM can update snapshots"
ON public.cpm_snapshots FOR UPDATE
TO authenticated
USING (public.is_admin_or_pm(auth.uid()));

-- Delete: admin or PM only
CREATE POLICY "Admin or PM can delete snapshots"
ON public.cpm_snapshots FOR DELETE
TO authenticated
USING (public.is_admin_or_pm(auth.uid()));

-- Also restrict cpm_activities write to admin/PM (XML upload + calculate writes here)
DROP POLICY IF EXISTS "Authenticated full access on cpm_activities" ON public.cpm_activities;

CREATE POLICY "Authenticated can read cpm_activities"
ON public.cpm_activities FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin or PM can insert cpm_activities"
ON public.cpm_activities FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_pm(auth.uid()));

CREATE POLICY "Admin or PM can update cpm_activities"
ON public.cpm_activities FOR UPDATE
TO authenticated
USING (public.is_admin_or_pm(auth.uid()));

CREATE POLICY "Admin or PM can delete cpm_activities"
ON public.cpm_activities FOR DELETE
TO authenticated
USING (public.is_admin_or_pm(auth.uid()));
