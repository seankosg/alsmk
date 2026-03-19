

# Project Calendar Feature Plan

## Requirements
- Weekly and monthly view toggle
- Hover over event shows creator name
- Public holidays displayed in red
- Sidebar position: after "Project Dashboard", before "My Dashboard"
- All members can create events; creator and admin can edit/delete

## 1. Database Migration — `calendar_events` table

```sql
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  end_date date,
  event_type text NOT NULL DEFAULT 'personal',  -- 'personal' | 'project'
  created_by uuid NOT NULL,  -- members.id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT/INSERT for all authenticated, UPDATE/DELETE for owner or admin
```

Trigger: reuse existing `update_updated_at_column()` for `updated_at`.

## 2. New Files

### `src/pages/Calendar.tsx`
- Toggle between **weekly** and **monthly** view (ToggleGroup)
- Monthly view: custom grid showing days with event dots/chips
- Weekly view: 7-column layout for selected week
- Public holidays (Korean holidays via static list or date-holidays library) shown with red background/text
- Click date → show day's events + "Add" button
- Hover event → tooltip showing creator name (using shadcn Tooltip)

### `src/components/calendar/MonthGrid.tsx`
- Renders 6-week grid for a month
- Each cell shows date number, event indicators, holiday marker (red)

### `src/components/calendar/WeekGrid.tsx`
- Renders 7-day columns for selected week
- Shows events as cards within each day column

### `src/components/calendar/EventDialog.tsx`
- Add/edit event dialog: title, description, date range, type (personal/project)
- Delete button visible only for creator or admin
- Edit fields enabled only for creator or admin

### `src/components/calendar/holidays.ts`
- Static list of Korean public holidays for current/next year
- Export `isHoliday(date: Date): boolean` and `getHolidayName(date: Date): string | null`

## 3. Modified Files

### `src/components/layout/AppSidebar.tsx`
- Add `{ title: "Calendar", url: "/calendar", icon: CalendarDays }` after Project Dashboard (index 1)

### `src/App.tsx`
- Add `<Route path="/calendar" element={<Calendar />} />` inside protected routes

## 4. UI Details
- Event color coding: project = blue badge, personal = green badge
- Holiday cells: red text for date number, light red background
- Tooltip on event hover: "작성자: {name}" with event title and type
- Month/week navigation with chevron buttons
- "Today" button to jump back to current date

## Files Summary
- **Create**: `src/pages/Calendar.tsx`, `src/components/calendar/MonthGrid.tsx`, `src/components/calendar/WeekGrid.tsx`, `src/components/calendar/EventDialog.tsx`, `src/components/calendar/holidays.ts`
- **Modify**: `src/App.tsx`, `src/components/layout/AppSidebar.tsx`
- **Migration**: `calendar_events` table + RLS + trigger

