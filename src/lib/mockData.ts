// Mock data for ALSMK Construction Project Management

export const mockTeams = [
  { id: "t1", name: "Design", code: "DES", created_at: "2026-01-01" },
  { id: "t2", name: "Procurement", code: "PRO", created_at: "2026-01-01" },
  { id: "t3", name: "Budget", code: "BUD", created_at: "2026-01-01" },
  { id: "t4", name: "Construction", code: "CON", created_at: "2026-01-01" },
];

export const mockParts = [
  { id: "p1", team_id: "t1", name: "Structural", code: "STR", created_at: "2026-01-01" },
  { id: "p2", team_id: "t1", name: "Electrical", code: "ELE", created_at: "2026-01-01" },
  { id: "p3", team_id: "t2", name: "Equipment", code: "EQP", created_at: "2026-01-01" },
  { id: "p4", team_id: "t2", name: "Materials", code: "MAT", created_at: "2026-01-01" },
  { id: "p5", team_id: "t3", name: "Cost Control", code: "CST", created_at: "2026-01-01" },
  { id: "p6", team_id: "t4", name: "Civil", code: "CIV", created_at: "2026-01-01" },
  { id: "p7", team_id: "t4", name: "Mechanical", code: "MEC", created_at: "2026-01-01" },
  { id: "p8", team_id: "t4", name: "Piping", code: "PIP", created_at: "2026-01-01" },
];

export const mockMembers = [
  { id: "m1", name: "James Kim", team_id: "t1", part_id: "p1", duty_title: "Lead Engineer", user_id: null },
  { id: "m2", name: "Sarah Lee", team_id: "t1", part_id: "p2", duty_title: "Electrical Engineer", user_id: null },
  { id: "m3", name: "David Park", team_id: "t2", part_id: "p3", duty_title: "Procurement Lead", user_id: null },
  { id: "m4", name: "Emily Chen", team_id: "t3", part_id: "p5", duty_title: "Cost Analyst", user_id: null },
  { id: "m5", name: "Mike Johnson", team_id: "t4", part_id: "p6", duty_title: "Site Manager", user_id: null },
  { id: "m6", name: "Alex Wang", team_id: "t4", part_id: "p7", duty_title: "Mechanical Lead", user_id: null },
  { id: "m7", name: "Chris Brown", team_id: "t4", part_id: "p8", duty_title: "Piping Supervisor", user_id: null },
  { id: "m8", name: "Anna Martinez", team_id: "t2", part_id: "p4", duty_title: "Materials Coordinator", user_id: null },
];

export const mockMilestones = [
  { id: "ms1", name: "Site Preparation", target_date: "2026-02-28", sort_order: 1, status: "completed" as const },
  { id: "ms2", name: "Foundation Work", target_date: "2026-05-15", sort_order: 2, status: "in_progress" as const },
  { id: "ms3", name: "Steel Erection", target_date: "2026-08-30", sort_order: 3, status: "upcoming" as const },
  { id: "ms4", name: "Equipment Install", target_date: "2026-11-15", sort_order: 4, status: "upcoming" as const },
  { id: "ms5", name: "Commissioning", target_date: "2027-02-28", sort_order: 5, status: "upcoming" as const },
  { id: "ms6", name: "Final Handover", target_date: "2027-05-31", sort_order: 6, status: "upcoming" as const },
];

export const mockTasks = [
  { id: "tk1", task_code: "DES-STR-2603-0001", title: "Foundation Design Review", milestone_id: "ms2", team_id: "t1", part_id: "p1", assignee_id: "m1", start_date: "2026-02-01", end_date: "2026-04-15", current_progress: 72, issue_flag: "normal" as const, issue_type: null, issue_description: null },
  { id: "tk2", task_code: "DES-ELE-2603-0001", title: "Electrical Layout Approval", milestone_id: "ms2", team_id: "t1", part_id: "p2", assignee_id: "m2", start_date: "2026-03-01", end_date: "2026-05-10", current_progress: 35, issue_flag: "warning" as const, issue_type: "Delay", issue_description: "Vendor specs pending for main transformer" },
  { id: "tk3", task_code: "PRO-EQP-2603-0001", title: "EAF Equipment Order", milestone_id: "ms3", team_id: "t2", part_id: "p3", assignee_id: "m3", start_date: "2026-01-15", end_date: "2026-06-30", current_progress: 60, issue_flag: "critical" as const, issue_type: "Supply Chain", issue_description: "Lead time extended by 8 weeks due to supplier delay" },
  { id: "tk4", task_code: "BUD-CST-2603-0001", title: "Q1 Cost Reconciliation", milestone_id: "ms2", team_id: "t3", part_id: "p5", assignee_id: "m4", start_date: "2026-03-01", end_date: "2026-03-31", current_progress: 90, issue_flag: "normal" as const, issue_type: null, issue_description: null },
  { id: "tk5", task_code: "CON-CIV-2603-0001", title: "Earthwork & Grading Phase 2", milestone_id: "ms2", team_id: "t4", part_id: "p6", assignee_id: "m5", start_date: "2026-02-15", end_date: "2026-04-30", current_progress: 55, issue_flag: "warning" as const, issue_type: "Weather", issue_description: "Rain delays affecting schedule by ~5 days" },
  { id: "tk6", task_code: "CON-MEC-2603-0001", title: "Cooling System Prep", milestone_id: "ms3", team_id: "t4", part_id: "p7", assignee_id: "m6", start_date: "2026-04-01", end_date: "2026-07-31", current_progress: 10, issue_flag: "normal" as const, issue_type: null, issue_description: null },
  { id: "tk7", task_code: "CON-PIP-2603-0001", title: "Underground Piping Layout", milestone_id: "ms2", team_id: "t4", part_id: "p8", assignee_id: "m7", start_date: "2026-03-01", end_date: "2026-05-15", current_progress: 40, issue_flag: "normal" as const, issue_type: null, issue_description: null },
  { id: "tk8", task_code: "PRO-MAT-2603-0001", title: "Rebar & Structural Steel PO", milestone_id: "ms2", team_id: "t2", part_id: "p4", assignee_id: "m8", start_date: "2026-02-01", end_date: "2026-04-01", current_progress: 85, issue_flag: "normal" as const, issue_type: null, issue_description: null },
];

export const mockActivityLog = [
  { id: "a1", user_name: "James Kim", action: "Updated progress to 72%", entity_type: "task", entity_id: "tk1", created_at: "2026-03-17T09:30:00Z" },
  { id: "a2", user_name: "Sarah Lee", action: "Flagged issue: Vendor specs pending", entity_type: "task", entity_id: "tk2", created_at: "2026-03-17T08:15:00Z" },
  { id: "a3", user_name: "David Park", action: "Escalated to critical: Supply chain delay", entity_type: "task", entity_id: "tk3", created_at: "2026-03-16T16:45:00Z" },
  { id: "a4", user_name: "Mike Johnson", action: "Added weather delay note", entity_type: "task", entity_id: "tk5", created_at: "2026-03-16T14:20:00Z" },
  { id: "a5", user_name: "Emily Chen", action: "Updated progress to 90%", entity_type: "task", entity_id: "tk4", created_at: "2026-03-16T11:00:00Z" },
  { id: "a6", user_name: "Anna Martinez", action: "Updated progress to 85%", entity_type: "task", entity_id: "tk8", created_at: "2026-03-15T15:30:00Z" },
  { id: "a7", user_name: "Admin", action: "Created milestone: Steel Erection", entity_type: "milestone", entity_id: "ms3", created_at: "2026-03-15T10:00:00Z" },
  { id: "a8", user_name: "Chris Brown", action: "Updated progress to 40%", entity_type: "task", entity_id: "tk7", created_at: "2026-03-14T16:00:00Z" },
];

export const mockPersonnelTargets = [
  { id: "pt1", team_id: "t1", part_id: "p1", target_headcount: 5, current_headcount: 4 },
  { id: "pt2", team_id: "t1", part_id: "p2", target_headcount: 4, current_headcount: 3 },
  { id: "pt3", team_id: "t2", part_id: "p3", target_headcount: 3, current_headcount: 3 },
  { id: "pt4", team_id: "t2", part_id: "p4", target_headcount: 3, current_headcount: 2 },
  { id: "pt5", team_id: "t3", part_id: "p5", target_headcount: 4, current_headcount: 3 },
  { id: "pt6", team_id: "t4", part_id: "p6", target_headcount: 12, current_headcount: 10 },
  { id: "pt7", team_id: "t4", part_id: "p7", target_headcount: 8, current_headcount: 6 },
  { id: "pt8", team_id: "t4", part_id: "p8", target_headcount: 6, current_headcount: 5 },
];

// Helper: calculate duration in days (inclusive, minimum 1)
export function calcDuration(startDate: string, endDate: string): number {
  const DAY = 86_400_000;
  const start = Date.UTC(
    ...startDate.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))) as [number, number, number]
  );
  const end = Date.UTC(
    ...endDate.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))) as [number, number, number]
  );
  return Math.max(1, Math.round((end - start) / DAY) + 1);
}

// Helper: duration-weighted average
export function weightedAvg(
  tasks: { start_date: string; end_date: string }[],
  valueFn: (t: any) => number
): number {
  if (tasks.length === 0) return 0;
  const totalDur = tasks.reduce((s, t) => s + calcDuration(t.start_date, t.end_date), 0);
  if (totalDur === 0) return 0;
  return Math.round(
    tasks.reduce((s, t) => s + valueFn(t) * calcDuration(t.start_date, t.end_date), 0) / totalDur
  );
}

// Helper: calculate planned progress (start & end dates are both inclusive working days)
export function calcPlannedProgress(startDate: string, endDate: string): number {
  const DAY = 86_400_000;
  const today = new Date();
  const nowUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const start = Date.UTC(
    ...startDate.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))) as [number, number, number]
  );
  const end = Date.UTC(
    ...endDate.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))) as [number, number, number]
  );
  const totalDays = Math.round((end - start) / DAY) + 1; // inclusive
  if (totalDays <= 0) return 100;
  const elapsedDays = Math.round((nowUtc - start) / DAY) + 1; // today counts as a worked day
  return Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
}

// Helper: get team name by id
export function getTeamName(teamId: string): string {
  return mockTeams.find(t => t.id === teamId)?.name ?? "Unknown";
}

// Helper: get part name by id
export function getPartName(partId: string | null): string {
  if (!partId) return "—";
  return mockParts.find(p => p.id === partId)?.name ?? "Unknown";
}

// Helper: get member name by id
export function getMemberName(memberId: string | null): string {
  if (!memberId) return "Unassigned";
  return mockMembers.find(m => m.id === memberId)?.name ?? "Unknown";
}

// Helper: get milestone name by id
export function getMilestoneName(milestoneId: string | null): string {
  if (!milestoneId) return "—";
  return mockMilestones.find(ms => ms.id === milestoneId)?.name ?? "Unknown";
}
