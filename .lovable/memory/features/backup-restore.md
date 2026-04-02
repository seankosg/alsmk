# Memory: features/backup-restore
Updated: now

## Backup/Restore System

### Phase 1: Manual Backup/Restore
- `data_backups` table stores JSON snapshots (RLS: authenticated read, admin write/delete)
- Edge Function `backup-export`: exports all 20 tables as JSON, optional `save_to_db: true`
- Edge Function `backup-import`: upserts data from JSON in dependency order
- Admin Settings UI: download backup (JSON file), save to DB, restore from file upload

### Phase 2: Soft Delete
- `deleted_at` + `deleted_by` columns added to: teams, parts, members, milestones, calendar_events
- All queries filter `.is("deleted_at", null)`
- Delete operations set `deleted_at` instead of hard delete
- Tasks already had soft delete (48h auto-cleanup via pg_cron)

### Phase 3: Automated Backups
- pg_cron job `daily-backup-export`: runs at midnight UTC, calls backup-export with save_to_db
- pg_cron job `cleanup-old-backups`: runs at 1 AM UTC, deletes backups older than 30 days
- Auto backup settings stored in project_settings: auto_backup_enabled, auto_backup_interval, auto_backup_retention

### Tables backed up
tasks, teams, parts, members, milestones, task_code_sequences, task_comments, issue_threads, calendar_events, cpm_activities, cpm_snapshots, cpm_task_mappings, conversations, conversation_members, direct_messages, personnel_targets, project_settings, notifications, activity_log, user_roles
