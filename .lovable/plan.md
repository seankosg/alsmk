

## Plan: Rename "General Manager" to "Project Manager"

A straightforward terminology update across the codebase. The organizational hierarchy becomes:

**Project Manager → Team → Part → Assignment (Duty/Member)**

### Changes Required

1. **`.lovable/plan.md`** — Update all references from "General Manager" to "Project Manager" in the plan document.

2. **Any seed data / mock data files** — Update role labels if "General Manager" appears in member roles or org hierarchy definitions.

3. **UI components** — Search and replace any rendered text referencing "General Manager" with "Project Manager" in dashboard, admin panel, or org chart components.

Since the app is still in early foundation stage, this is primarily a plan document and naming convention update that will carry forward into all future implementation.

