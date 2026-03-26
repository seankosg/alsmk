Phase 2+3+4 CPM-Task integration: cpm_activities + cpm_task_mappings + cpm_snapshots tables with postMessage bridge + node risk visualization.

## Tables
- cpm_activities: mpp_uid, mpp_task_id, name, duration, progress, wbs_full, is_critical, is_milestone, start/finish dates, ES/EF/LS/LF/TF
- cpm_task_mappings: activity_id → task_id (many-to-many, unique constraint)
- cpm_snapshots: name, data (jsonb full network state), created_by, timestamps — shared across all users

## postMessage Protocol
- iframe → parent: `iframe-ready`, `cpm-calculated`, `activity-click`, `activity-detail-click`, `snapshot-save`, `snapshot-restored`, `snapshot-current`
- parent → iframe: `request-cpm-data`, `set-role`, `activity-status-update`, `snapshot-restore`, `bootstrap-empty`

## Bootstrap Flow (Parent-Driven)
1. iframe init → localStorage? → restore + calculate
2. No localStorage → send `iframe-ready` to parent
3. Parent receives `iframe-ready` → query DB for name='auto' snapshot
4. DB has snapshot → send `snapshot-restore`; no snapshot → send `bootstrap-empty`
5. iframe: `snapshot-restore` → _restoreSnapshot + calculate; `bootstrap-empty` → loadSample + calculate
6. 5-second fallback timeout in iframe if parent doesn't respond

## Data Persistence
- localStorage: fast local cache, saved on every calculate()
- DB (cpm_snapshots): name='auto' for auto-save on calculate; named snapshots for manual save
- On load: localStorage first → if empty, parent-driven bootstrap from DB

## Activity Status Key
- Format: `${mpp_task_id}::${wbs_full}::${name}` — avoids duplicate name collisions

## Components
- src/pages/CpmScheduler.tsx: iframe + side panel layout, message listener, DB upsert, status aggregation + postMessage, snapshot save/load, parent-driven bootstrap handler
- src/components/cpm/ActivityTaskPanel.tsx: detail header (dblclick) + 3-tier task hierarchy with GAP%
- src/components/cpm/MapTasksDialog.tsx: searchable task picker with checkbox multi-select
- src/components/cpm/MapActivitiesDialog.tsx: reverse mapping (Task → Activity) from TaskDetailDialog
- src/components/cpm/SnapshotManager.tsx: snapshot CRUD UI (Admin/PM only)

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
