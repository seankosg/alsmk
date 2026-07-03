
CREATE POLICY "rfi-uploads admin/pm all" ON storage.objects FOR ALL
  USING (bucket_id = 'rfi-uploads' AND public.is_admin_or_pm(auth.uid()))
  WITH CHECK (bucket_id = 'rfi-uploads' AND public.is_admin_or_pm(auth.uid()));
