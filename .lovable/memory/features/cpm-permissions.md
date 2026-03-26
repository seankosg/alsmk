CPM role-based permissions: Admin/PM can XML upload, calculate, snapshot save/load/delete. Regular users read-only + task mapping only.

## DB
- `is_admin_or_pm(uuid)` security definer function checks user_roles(admin) OR members(is_pm)
- cpm_snapshots: SELECT=all authenticated, INSERT/UPDATE/DELETE=admin_or_pm only
- cpm_activities: SELECT=all authenticated, INSERT/UPDATE/DELETE=admin_or_pm only
- cpm_task_mappings: unchanged (all authenticated full access)

## Frontend
- CpmScheduler sends `set-role` postMessage to iframe on load
- iframe hides upload zone, calculate button, add button, footer-row, delete buttons for non-admin/PM
- iframe sidebar inputs disabled for read-only users
- SnapshotManager uses `isAdminOrPm` for save/load/delete visibility
- cpm-calculated and snapshot-save messages ignored in parent for non-admin/PM
