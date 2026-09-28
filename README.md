# ALSMK Management

Build a comprehensive Construction Project Management Web Application (Project Code: ALSMK - US Electric Steel Mill). The app focuses on a "Bird's-eye view to Drill-down" philosophy, allowing users to see overall progress and zoom into critical issues. 

Tech Stack: React, Tailwind CSS, shadcn/ui, Lucide Icons, and Supabase (for persistent cloud DB, Auth, and Storage). 

Design & Language: Strict Dark Mode, modern, intuitive, and professional UI. **The default UI language for all menus and labels must be English. However, all text input fields must support multi-language input without any restrictions (UTF-8).**

1. System & Architecture Constraints

- Supabase Integration: Set up a robust Supabase database from the start so all test data and configurations are securely saved in the cloud and persist across sessions.

- Performance: Apply DB indexing on frequently queried columns (like Team, Status, Issue Flag) and use pagination/lazy loading for activity logs to ensure lightning-fast data loading.

- Auth Bypass (Dev Mode): Build the Login/Signup UI, but temporarily bypass the routing so developers land directly on the Master Dashboard automatically as an "Admin" role without needing to log in.

2. Organizational Hierarchy & Task Code Generation (Crucial)

- Hierarchy: General Manager -> Team -> Part -> Assignee.

- Default Teams: Design, Procurement, Budget, Construction.

- Admin Org Management: In the Admin Panel, when admins create or edit a "Team" or "Part", they MUST input a specific short code for it (e.g., Team Name: Construction, Team Code: CON / Part Name: Structure, Part Code: STR).

- Task Unique Code (Auto-generated at DB level): Generate a unique ID seamlessly upon DB insertion (to prevent concurrent creation collisions) in the exact format: [TeamCode]-[PartCode]-[YYMM]-[AutoIncrement4Digits] (e.g., CON-STR-2603-0001).

- Excel/CSV Import: Users must be able to upload tasks via an Excel/CSV template without Task Codes. The system should automatically generate and assign Task Codes using the logic above upon upload. Provide a "Download Template" button.

3. Database Schema (Task Model)

- Task Title (Required)

- Milestone (Required, mapped to global project milestones)

- Assignee (Auto-mapped to Team/Part/Person)

- Start Date & End Date (Required)

- Planned Progress % (Auto-calculated based on today's date vs. duration)

- Current Progress % (User input)

- Progress Gap (Current % - Planned %, visually styled: blue for ahead, red for delayed)

- Critical Issue Flag (Toggle: Normal, Warning, Severe)

- Issue Type & Description (Required if Flag is on)

- Issue Thread (Comment section for resolving issues)

4. Master Dashboard (The Cockpit)

- Global Header: Project Name (ALSMK) and a Notification Inbox icon.

- Milestone Stepper: A beautiful, horizontal subway-map-style timeline at the very top showing major project milestones with a "Today" indicator pin. (Admins can manage these milestones).

- Project HUD: Big donut chart for Overall Planned vs. Actual Progress %, and D-Day counter.

- Drill-down Heatmap: Block UI showing each Team/Part. Green if normal, Red if an issue exists. Clicking a Red block drills down into the specific delayed tasks and issue descriptions.

- Critical Issue Board: A prioritized list of tasks with active Issue Flags.

- Activity Stream: Real-time scrolling log of user updates and task creations.

- T/O & Personnel Table: A summary table showing Team/Part, Target Headcount, Current Headcount, and Vacancies.

5. User Roles & Workspace

- My Workspace: Users see and update only their assigned tasks. Can adjust their own auto-save interval settings (e.g., 1 min, 5 min). **Must include an "Export to Excel" button so users can download their own inputted tasks and progress data.**

- Read-only Directory: Users can view other members' workspaces in read-only mode.

- Admin Capabilities: Admins can manage the Org chart, milestones, and have the ability to edit or reassign tasks on behalf of absent/resigned members.

Please generate the complete foundational structure, Supabase schema SQL (including the edge function/trigger for the exact Task Code generation format), and the initial interactive Dashboard UI.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://alsmk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7c8c38db-281c-4555-a1cf-a03cff88f1b0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
