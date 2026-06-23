CREATE POLICY "mdr-templates admin/pm select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mdr-templates' AND public.is_admin_or_pm(auth.uid()));

CREATE POLICY "mdr-templates admin/pm insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mdr-templates' AND public.is_admin_or_pm(auth.uid()));

CREATE POLICY "mdr-templates admin/pm update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'mdr-templates' AND public.is_admin_or_pm(auth.uid()))
WITH CHECK (bucket_id = 'mdr-templates' AND public.is_admin_or_pm(auth.uid()));

CREATE POLICY "mdr-templates admin/pm delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mdr-templates' AND public.is_admin_or_pm(auth.uid()));