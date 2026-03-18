Issue flag notification system: notifications table with RLS, realtime enabled.

## Rules
- Flag edit permission: only task assignee + PM + Admin can change issue_flag
- When flag changes normal→warning/critical, "Notify Members" section appears with checkbox list
- Notifications are batch-inserted on save for selected recipients
- NotificationBell in header shows unread count badge + dropdown list
- Realtime subscription for instant toast on new notifications
- RLS: users can only read/update their own notifications (by member_id → user_id match)
