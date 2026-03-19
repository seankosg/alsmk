-- Members can delete their own messages
CREATE POLICY "Members can delete own messages"
ON public.direct_messages FOR DELETE TO authenticated
USING (
  is_conversation_member(conversation_id, auth.uid())
  AND sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- Members can delete conversations they belong to
CREATE POLICY "Members can delete conversations"
ON public.conversations FOR DELETE TO authenticated
USING (is_conversation_member(id, auth.uid()));

-- Members can delete conversation_members for conversations they belong to
CREATE POLICY "Members can delete conversation members"
ON public.conversation_members FOR DELETE TO authenticated
USING (is_conversation_member(conversation_id, auth.uid()));