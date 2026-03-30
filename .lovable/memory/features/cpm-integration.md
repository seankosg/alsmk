Phase 2+3+4+5 CPM-Task integration: cpm_activities + cpm_task_mappings + cpm_snapshots tables with postMessage bridge + node risk visualization + orphan migration.

## Tables
- cpm_activities: mpp_uid, mpp_task_id, name, duration, progress, wbs_full, is_critical, is_milestone, start/finish dates, ES/EF/LS/LF/TF
- cpm_task_mappings: activity_id → task_id (many-to-many, unique constraint)
- cpm_snapshots: name, data (jsonb full network state), created_by, timestamps — shared across all users

## postMessage Protocol
- iframe → parent: `cpm-calculated`, `activity-click`, `activity-detail-click`, `snapshot-save`, `request-db-snapshot`, `snapshot-current`
- parent → iframe: `request-cpm-data`, `activity-status-update`, `snapshot-restore`, `request-snapshot`, `set-read-only`

## Read-Only Mode (일반 사용자)
- Parent sends `set-read-only` message on iframe load based on `isAdminOrPm`
- iframe hides: upload-zone, btn-calc, footer-row (초기화 buttons), btn-add, btn-del
- `calculate()` guarded by `_readOnly` flag (except `forceReadOnly` param for snapshot restore)
- `postSnapshotSave()` guarded by `_readOnly` flag
- Parent ignores `cpm-calculated` and `snapshot-save` messages for non-admin/PM users
- SnapshotManager button hidden for non-admin/PM users
- MapTasksDialog hidden for non-admin/PM users in ActivityTaskPanel
- Snapshot delete button uses `isAdminOrPm` (was `isAdmin`)

## Data Persistence (Phase 4)
- localStorage: fast local cache, saved on every calculate()
- DB (cpm_snapshots): full network state as JSONB, saved on every calculate() via postSnapshotSave()
- On load: localStorage first → if empty, request DB snapshot → if DB newer than localStorage, restore from DB
- All logged-in users share the same CPM network

## Activity Status Key
- Format: `${mpp_task_id}::${wbs_full}::${name}` — avoids duplicate name collisions

## Components
- src/pages/CpmScheduler.tsx: iframe + side panel layout, message listener, DB upsert, status aggregation + postMessage, snapshot save/load, orphan migration
- src/components/cpm/ActivityTaskPanel.tsx: detail header (dblclick) + 3-tier task hierarchy with GAP%
- src/components/cpm/MapTasksDialog.tsx: searchable task picker with checkbox multi-select
- src/components/cpm/MapActivitiesDialog.tsx: reverse mapping (Task → Activity) from TaskDetailDialog
- src/components/cpm/OrphanResolutionDialog.tsx: orphan activity resolution UI (migrate/delete)

## Keep-Alive
- CpmScheduler mounted persistently in AppLayout, toggled via CSS display based on route
- `hasVisitedCpm` state for lazy mount (iframe only loads on first /cpm visit)

## Node Click Behavior
- Single click: opens side panel with task mappings (basic header)
- Double click: opens side panel with full detail view (dates, ES/EF/LS/LF, TF, predecessors, progress)
- Shift+click: jumpToWbs (WBS tab navigation)

## Node Risk Visualization (Phase 3)
- Node header shows mapped task counts: ● total (white), ● onTrack (green), ● delayed (red)
- Single-line layered progress bar: gray=#555 planned, blue=#4da6ff actual, red=#ff4d4d gap
- NODE_H = 104, status data sent via activity-status-update postMessage
- Unmapped activities show ● 0 ● 0 ● 0

## Workspace Deep Link
- ?task={id} scrolls to and highlights the matching task row

## Weighted Progress
- Formula: Σ(progress × duration) / Σ(duration), GAP = actual - planned
- Delayed threshold: actual < planned - 5%

## Orphan Migration (Phase 5)
- On new XML upload + CPM calculate, upsertActivities detects orphan activities
- Step 1: Auto-migrate mappings by name match (orphan.name === newActivity.name)
- Step 2: Orphans with mappings but no name match → OrphanResolutionDialog
- Step 3: Orphans without mappings → silently deleted
- All actions logged to activity_log with details (resolution type, migrated_to, task_ids)
- OrphanResolutionDialog: per-orphan migrate (dropdown) or delete, bulk delete all
- **CRITICAL**: Orphan detection only runs on `isNewImport: true` (new XML upload). Hydration and manual recalculation use `upsertActivitiesOnly` (no orphan detection).
- **ID-based orphan detection**: Uses `.select()` on upsert to get returned IDs; orphans = DB rows not in upserted set (fixes null key issues).
- **Semantic key matching**: Auto-migration uses composite key `BLDG::WBS_L2::Name` instead of name-only. `semantic_key` TEXT column on `cpm_activities`. Duplicate semantic keys skip auto-migration → sent to OrphanResolutionDialog.
- **Duplicate name guard**: Replaced by semantic key uniqueness check.
- **OrphanResolutionDialog UI**: Shows BLDG badge, WBS Level2, and full WBS for each orphan. Dropdown items show `BLDG · WBS_L2 · Name` format.
- **Atomic migration**: Uses `upsert_activity_mappings` RPC with merged task IDs to prevent duplicate mappings.
- **Query limit**: `.limit(5000)` on cpm_activities queries to avoid 1000-row truncation.
- **DB unique constraint**: `cpm_activities(mpp_uid)` UNIQUE — mpp_uid는 XML 재 Export에도 불변이므로 WBS 변경 시에도 동일 행이 업데이트됨. `cpm_task_mappings(activity_id, task_id)` UNIQUE prevents duplicate mapping rows.

## Mapping Atomicity
- `upsert_activity_mappings(_activity_id, _task_ids[])` RPC: atomic delete+insert for Activity→Task mappings
- `upsert_task_mappings(_task_id, _activity_ids[])` RPC: atomic delete+insert for Task→Activity mappings
- Prevents race conditions between concurrent users

## Hydration Post Suppression
- `_suppressPost` flag in iframe prevents `postCpmCalculated()` and `postSnapshotSave()` during hydrate's `calculate(true)`
- Prevents unnecessary DB upserts and orphan detection on page load/refresh
