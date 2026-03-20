
-- Author can update own comments
CREATE POLICY "Author can update own comments" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (author_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (author_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Admin can update any comment
CREATE POLICY "Admin can update any comment" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Author can delete own comments
CREATE POLICY "Author can delete own comments" ON public.task_comments
  FOR DELETE TO authenticated
  USING (author_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Admin can delete any comment
CREATE POLICY "Admin can delete any comment" ON public.task_comments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add cascade delete for replies when parent comment is deleted
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_parent_comment_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_parent_comment_id_fkey
  FOREIGN KEY (parent_comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;
