Phase 2+3 CPM-Task integration: cpm_activities + cpm_task_mappings tables with postMessage bridge + node risk visualization.

## Tables
- cpm_activities: mpp_uid, mpp_task_id, name, duration, progress, wbs_full, is_critical, is_milestone, start/finish dates, ES/EF/LS/LF/TF
- cpm_task_mappings: activity_id → task_id (many-to-many, unique constraint)

## postMessage Protocol
- iframe → parent: `cpm-calculated` (all activities array), `activity-click` (single activity)
- parent → iframe: `request-cpm-data`, `activity-status-update` (statuses array with task counts + progress)

## Components
- src/pages/CpmScheduler.tsx: iframe + side panel layout, message listener, DB upsert, status aggregation + postMessage
- src/components/cpm/ActivityTaskPanel.tsx: 3-tier hierarchy (Team → Assignee → Task) with GAP% metrics
- src/components/cpm/MapTasksDialog.tsx: searchable task picker with checkbox multi-select
- src/components/cpm/MapActivitiesDialog.tsx: reverse mapping (Task → Activity) from TaskDetailDialog

## Node Risk Visualization (Phase 3)
- Node header shows mapped task counts: ● total (white), ● onTrack (green #3dd68c), ● delayed (red #ff4d4d)
- Single-line layered progress bar: gray (#555) = planned, blue (#4da6ff) = actual, red (#ff4d4d) = gap when actual < planned
- NODE_H increased from 92 to 104 to accommodate status row
- Status data sent via `activity-status-update` postMessage after upsert
- Unmapped activities show original single progress bar

## Node Click Behavior
- Normal click: sends activity-click to React parent (opens side panel)
- Shift+click: original jumpToWbs behavior (WBS tab navigation)

## Workspace Deep Link
- ?task={id} scrolls to and highlights the matching task row (data-task-id attribute)

## Weighted Progress
- Formula: Σ(progress × duration) / Σ(duration) at each hierarchy level
- GAP = actual weighted % − planned weighted %
- Delayed threshold: actual < planned - 5%
