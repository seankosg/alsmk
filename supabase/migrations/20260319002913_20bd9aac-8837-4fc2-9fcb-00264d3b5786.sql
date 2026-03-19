
-- 1. Task Comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'comment',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_comments"
  ON public.task_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert task_comments"
  ON public.task_comments FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 3. Conversation Members table
CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, member_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- 4. Direct Messages table
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  message text NOT NULL,
  referenced_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.conversation_id = _conversation_id
      AND m.user_id = _user_id
  )
$$;

-- Conversations RLS
CREATE POLICY "Members can view own conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "Authenticated can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (true);

-- Conversation Members RLS
CREATE POLICY "Members can view conversation members"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Authenticated can add conversation members"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (true);

-- Direct Messages RLS
CREATE POLICY "Members can view messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can update messages"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
