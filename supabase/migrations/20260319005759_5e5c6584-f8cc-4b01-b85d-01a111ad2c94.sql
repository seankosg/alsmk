
DROP POLICY IF EXISTS "Members can view own conversations" ON public.conversations;

CREATE POLICY "Authenticated can view conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (true);
