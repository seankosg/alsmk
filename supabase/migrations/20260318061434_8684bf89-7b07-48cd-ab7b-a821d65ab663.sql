
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'flag_raised',
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications (match member's user_id)
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  recipient_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  )
);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  recipient_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  recipient_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  )
);

-- Authenticated users can insert notifications
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
