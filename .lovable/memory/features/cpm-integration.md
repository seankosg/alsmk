Phase 2+3 CPM-Task integration: cpm_activities + cpm_task_mappings tables with postMessage bridge + node risk visualization.

## Tables
- cpm_activities: mpp_uid, mpp_task_id, name, duration, progress, wbs_full, is_critical, is_milestone, start/finish dates, ES/EF/LS/LF/TF
- cpm_task_mappings: activity_id → task_id (many-to-many, unique constraint)

## postMessage Protocol
- iframe → parent: `cpm-calculated`, `activity-click` (single click), `activity-detail-click` (dblclick with predecessors)
- parent → iframe: `request-cpm-data`, `activity-status-update` (statuses array with activityKey)

## Activity Status Key
- Format: `${mpp_task_id}::${wbs_full}::${name}` — avoids duplicate name collisions

## Components
- src/pages/CpmScheduler.tsx: iframe + side panel layout, message listener, DB upsert, status aggregation + postMessage
- src/components/cpm/ActivityTaskPanel.tsx: detail header (dblclick) + 3-tier task hierarchy with GAP%
- src/components/cpm/MapTasksDialog.tsx: searchable task picker with checkbox multi-select
- src/components/cpm/MapActivitiesDialog.tsx: reverse mapping (Task → Activity) from TaskDetailDialog

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
