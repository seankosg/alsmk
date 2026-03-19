

# Dashboard Redesign + Donut Gap Display

## Changes

### 1. `ProjectHUD.tsx` — Redesign

**Donut chart card**: Replace center text from `avgProgress%` to **gap value** (`avgProgress - avgPlanned`).
- Positive gap → green text (e.g., `+5%p`)
- Negative gap → red text (e.g., `-3%p`)
- Keep the legend below showing Actual/Plan percentages

**3 metric cards → 1 Task Summary card**: Replace Total Tasks, Active Issues, Completion Rate with a single card containing a 2x2 grid:
- Total (all tasks count)
- Completed (`current_progress >= 100`)
- In Progress (`current_progress > 0 && < 100`)
- Not Started (`current_progress === 0`)

Layout: `grid-cols-2` — donut card + summary card side by side.

### 2. `CategoryProgressChart.tsx` — New Component

Clone `TeamProgressChart` logic but group by `task.category` instead of `team_id`:
- X-axis: category names (null → "Uncategorized")
- Y-axis: avg planned vs actual progress per category
- Bar click → drilldown dialog showing behind-schedule tasks in that category
- Same color logic: actual >= planned → primary, else destructive

### 3. `Index.tsx` — Layout Reorganization

```text
1. MilestoneTimeline              (full width)
2. ProjectHUD (donut + summary)   (full width, internal 2-col)
3. TeamProgress | CategoryProgress (2 col)
4. BehindSchedule | CriticalIssue  (2 col)
5. UpcomingDeadlines | TaskDistribution (2 col)
6. IssueTrend | TeamHeatmap        (2 col)
7. PartStatusBoard                 (full width)
8. ActivityStream                  (full width)
9. PersonnelTable                  (full width)
```

## Files
- **Modify**: `src/components/dashboard/ProjectHUD.tsx`, `src/pages/Index.tsx`
- **Create**: `src/components/dashboard/CategoryProgressChart.tsx`

