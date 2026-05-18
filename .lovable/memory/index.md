# Project Memory

## Core
ALSMK US Electric Steel Mill — Construction Project Management App. Dark mode, English UI, UTF-8 inputs.
React, Tailwind, shadcn/ui, Lucide, Supabase (Lovable Cloud).
Email+password login via edge function. First user auto-admin. Auth guard in AppLayout.
Org: PM → Team → Part → Assignment. Task code auto-generated via DB trigger.
CPM Manager: DB-centric hydration (not localStorage). Single cpm-hydrate message. Realtime on cpm_task_mappings.

## Memories
- [CPM Integration](mem://features/cpm-integration) — DB-centric architecture, cpm-hydrate flow, status key format, realtime sync
- [Notifications](mem://features/notifications) — Notification system with bell icon, task-based alerts
- [Soft Delete](mem://features/soft-delete) — Tasks use deleted_at/deleted_by for soft deletion
- [Summary Tasks](mem://features/summary-tasks) — is_summary=true, parent_id linking subtasks
- [Messaging](mem://features/messaging) — task_comments, conversations, direct_messages with RLS + realtime
- [Design & DB](mem://features/design-and-db) — Dark mode forced, JetBrains Mono headings, Inter body, custom tokens
- [CPM Orphan Center](mem://features/cpm/orphan-center) — Task 중심 재매핑 UI, 추천 점수 체계, NewActivityCombobox, 자동 삭제 이력 네비게이션
