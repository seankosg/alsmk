Phase 2 CPM-Task integration: cpm_activities + cpm_task_mappings tables with postMessage bridge.

## Tables
- cpm_activities: mpp_uid, mpp_task_id, name, duration, progress, wbs_full, is_critical, is_milestone, start/finish dates, ES/EF/LS/LF/TF
- cpm_task_mappings: activity_id → task_id (many-to-many, unique constraint)

## postMessage Protocol
- iframe → parent: `cpm-calculated` (all activities array), `activity-click` (single activity)
- parent → iframe: `request-cpm-data`

## Components
- src/pages/CpmScheduler.tsx: iframe + side panel layout, message listener, DB upsert
- src/components/cpm/ActivityTaskPanel.tsx: 3-tier hierarchy (Team → Assignee → Task) with GAP% metrics
- src/components/cpm/MapTasksDialog.tsx: searchable task picker with checkbox multi-select

## Node Click Behavior
- Normal click: sends activity-click to React parent (opens side panel)
- Shift+click: original jumpToWbs behavior (WBS tab navigation)

## Workspace Deep Link
- ?task={id} scrolls to and highlights the matching task row (data-task-id attribute)

## Weighted Progress
- Formula: Σ(progress × duration) / Σ(duration) at each hierarchy level
- GAP = actual weighted % − planned weighted %
