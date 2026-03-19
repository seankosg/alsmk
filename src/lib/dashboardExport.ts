import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";
import { differenceInCalendarDays, startOfDay, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

interface TaskRow {
  id: string;
  task_code: string | null;
  title: string;
  team_id: string;
  part_id: string | null;
  assignee_id: string | null;
  start_date: string;
  end_date: string;
  current_progress: number;
  issue_flag: string;
  issue_type: string | null;
  issue_description: string | null;
  milestone_id: string | null;
}

interface TeamRow { id: string; name: string; code: string }
interface MilestoneRow { id: string; name: string; target_date: string; status: string; sort_order: number }
interface MemberRow { id: string; name: string }

async function fetchDashboardData() {
  const [tasksRes, teamsRes, milestonesRes, membersRes] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("milestones").select("*").order("sort_order"),
    supabase.from("members").select("id, name"),
  ]);
  if (tasksRes.error) throw tasksRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (milestonesRes.error) throw milestonesRes.error;
  if (membersRes.error) throw membersRes.error;
  return {
    tasks: tasksRes.data as TaskRow[],
    teams: teamsRes.data as TeamRow[],
    milestones: milestonesRes.data as MilestoneRow[],
    members: membersRes.data as MemberRow[],
  };
}

function memberName(members: MemberRow[], id: string | null) {
  if (!id) return "Unassigned";
  return members.find(m => m.id === id)?.name ?? "Unknown";
}

function teamName(teams: TeamRow[], id: string) {
  return teams.find(t => t.id === id)?.name ?? "Unknown";
}

function dDay(targetDate: string) {
  const diff = differenceInCalendarDays(parseLocalDate(targetDate), startOfDay(new Date()));
  return diff > 0 ? `D-${diff}` : diff === 0 ? "D-Day" : `D+${Math.abs(diff)}`;
}

function dateStr() {
  return format(new Date(), "yyyy-MM-dd");
}

// ─── Excel Export ───────────────────────────────────────────

export async function exportDashboardExcel() {
  const { tasks, teams, milestones, members } = await fetchDashboardData();
  const wb = XLSX.utils.book_new();

  const totalTasks = tasks.length;
  const avgActual = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgPlanned = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks) : 0;
  const completed = tasks.filter(t => t.current_progress >= 100).length;
  const inProgress = tasks.filter(t => t.current_progress > 0 && t.current_progress < 100).length;
  const notStarted = tasks.filter(t => t.current_progress === 0).length;

  // Sheet 1: Summary
  const summaryData = [
    ["ALSMK US Electric Steel Mill — Project Report"],
    ["Generated", dateStr()],
    [],
    ["Metric", "Value"],
    ["Total Tasks", totalTasks],
    ["Completed", completed],
    ["In Progress", inProgress],
    ["Not Started", notStarted],
    ["Avg Plan %", `${avgPlanned}%`],
    ["Avg Actual %", `${avgActual}%`],
    ["Gap (%p)", `${avgActual - avgPlanned}%p`],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

  // Sheet 2: Milestones
  const msHeader = ["Name", "Target Date", "Status", "D-Day"];
  const msRows = milestones.map(ms => [ms.name, ms.target_date, ms.status, dDay(ms.target_date)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([msHeader, ...msRows]), "Milestones");

  // Sheet 3: Team Progress
  const tpHeader = ["Team", "Tasks", "Avg Plan %", "Avg Actual %", "Gap (%p)"];
  const tpRows = teams.map(team => {
    const tt = tasks.filter(t => t.team_id === team.id);
    const cnt = tt.length;
    const ap = cnt > 0 ? Math.round(tt.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / cnt) : 0;
    const aa = cnt > 0 ? Math.round(tt.reduce((s, t) => s + t.current_progress, 0) / cnt) : 0;
    return [team.name, cnt, `${ap}%`, `${aa}%`, `${aa - ap}%p`];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tpHeader, ...tpRows]), "Team Progress");

  // Sheet 4: Behind Schedule
  const behindTasks = tasks
    .map(t => ({ ...t, planned: calcPlannedProgress(t.start_date, t.end_date), gap: t.current_progress - calcPlannedProgress(t.start_date, t.end_date) }))
    .filter(t => t.gap < 0 && t.current_progress < 100)
    .sort((a, b) => a.gap - b.gap);
  const bsHeader = ["Task Code", "Title", "Team", "Assignee", "Plan %", "Actual %", "Gap (%p)"];
  const bsRows = behindTasks.map(t => [
    t.task_code ?? "", t.title, teamName(teams, t.team_id), memberName(members, t.assignee_id),
    `${t.planned}%`, `${t.current_progress}%`, `${t.gap}%p`,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([bsHeader, ...bsRows]), "Behind Schedule");

  // Sheet 5: Critical Issues
  const issueTasks = tasks.filter(t => t.issue_flag !== "normal");
  const ciHeader = ["Task Code", "Title", "Team", "Assignee", "Flag", "Issue Type", "Description"];
  const ciRows = issueTasks.map(t => [
    t.task_code ?? "", t.title, teamName(teams, t.team_id), memberName(members, t.assignee_id),
    t.issue_flag, t.issue_type ?? "", t.issue_description ?? "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ciHeader, ...ciRows]), "Critical Issues");

  XLSX.writeFile(wb, `ALSMK_Report_${dateStr()}.xlsx`);
}

// ─── PowerPoint Export ──────────────────────────────────────

const NAVY = "00205B";
const BLUE = "1B69B5";
const WHITE = "FFFFFF";
const LIGHT_BG = "F0F4F8";
const RED = "DC2626";
const AMBER = "D97706";
const GREEN = "16A34A";

export async function exportDashboardPptx() {
  const { tasks, teams, milestones, members } = await fetchDashboardData();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "ALSMK Project";

  const totalTasks = tasks.length;
  const avgActual = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgPlanned = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks) : 0;
  const gap = avgActual - avgPlanned;
  const completed = tasks.filter(t => t.current_progress >= 100).length;
  const inProgress = tasks.filter(t => t.current_progress > 0 && t.current_progress < 100).length;
  const notStarted = tasks.filter(t => t.current_progress === 0).length;

  // === Slide 1: Title ===
  const slide1 = pptx.addSlide();
  slide1.background = { color: NAVY };
  slide1.addText("ALSMK US Electric Steel Mill", { x: 0.8, y: 1.0, w: 8.4, h: 1.0, fontSize: 32, bold: true, color: WHITE, fontFace: "Arial" });
  slide1.addText("Project Report", { x: 0.8, y: 1.9, w: 8.4, h: 0.6, fontSize: 20, color: BLUE, fontFace: "Arial" });
  slide1.addText(format(new Date(), "yyyy.MM.dd"), { x: 0.8, y: 2.6, w: 8.4, h: 0.4, fontSize: 14, color: "AABBCC", fontFace: "Arial" });

  const kpiData: PptxGenJS.TableRow[] = [
    [
      { text: "Total Tasks", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "Completed", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "In Progress", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "Not Started", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "Avg Plan", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "Avg Actual", options: { fontSize: 10, color: "AABBCC", align: "center" } },
      { text: "Gap", options: { fontSize: 10, color: "AABBCC", align: "center" } },
    ],
    [
      { text: `${totalTasks}`, options: { fontSize: 24, bold: true, color: WHITE, align: "center" } },
      { text: `${completed}`, options: { fontSize: 24, bold: true, color: GREEN, align: "center" } },
      { text: `${inProgress}`, options: { fontSize: 24, bold: true, color: BLUE, align: "center" } },
      { text: `${notStarted}`, options: { fontSize: 24, bold: true, color: "999999", align: "center" } },
      { text: `${avgPlanned}%`, options: { fontSize: 24, bold: true, color: AMBER, align: "center" } },
      { text: `${avgActual}%`, options: { fontSize: 24, bold: true, color: BLUE, align: "center" } },
      { text: `${gap > 0 ? "+" : ""}${gap}%p`, options: { fontSize: 24, bold: true, color: gap >= 0 ? GREEN : RED, align: "center" } },
    ],
  ];
  slide1.addTable(kpiData, { x: 0.5, y: 3.6, w: 9.0, colW: [1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.2], border: { type: "none" } });

  // === Slide 2: Milestones ===
  const slide2 = pptx.addSlide();
  slide2.background = { color: WHITE };
  slide2.addText("Milestone Timeline", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: NAVY, fontFace: "Arial" });

  const msTableHeader: PptxGenJS.TableRow = [
    { text: "Milestone", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "left" } },
    { text: "Target Date", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Status", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "D-Day", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
  ];
  const msTableRows: PptxGenJS.TableRow[] = milestones.map((ms, i) => {
    const bg = i % 2 === 0 ? LIGHT_BG : WHITE;
    const statusColor = ms.status === "completed" ? GREEN : ms.status === "delayed" ? RED : ms.status === "in_progress" ? BLUE : "666666";
    return [
      { text: ms.name, options: { fontSize: 10, fill: { color: bg }, color: "333333" } },
      { text: ms.target_date, options: { fontSize: 10, fill: { color: bg }, color: "333333", align: "center" } },
      { text: ms.status.replace("_", " "), options: { fontSize: 10, fill: { color: bg }, color: statusColor, bold: true, align: "center" } },
      { text: dDay(ms.target_date), options: { fontSize: 10, fill: { color: bg }, color: "333333", align: "center" } },
    ];
  });
  slide2.addTable([msTableHeader, ...msTableRows], {
    x: 0.5, y: 1.1, w: 9.0, colW: [3.5, 2.0, 2.0, 1.5],
    border: { type: "solid", pt: 0.5, color: "DDDDDD" },
    rowH: 0.4,
  });

  // === Slide 3: Team Progress ===
  const slide3 = pptx.addSlide();
  slide3.background = { color: WHITE };
  slide3.addText("Team Progress", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: NAVY, fontFace: "Arial" });

  const tpTableHeader: PptxGenJS.TableRow = [
    { text: "Team", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Tasks", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Plan %", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Actual %", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Gap (%p)", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
  ];
  const tpTableRows: PptxGenJS.TableRow[] = teams.map((team, i) => {
    const tt = tasks.filter(t => t.team_id === team.id);
    const cnt = tt.length;
    const ap = cnt > 0 ? Math.round(tt.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / cnt) : 0;
    const aa = cnt > 0 ? Math.round(tt.reduce((s, t) => s + t.current_progress, 0) / cnt) : 0;
    const g = aa - ap;
    const bg = i % 2 === 0 ? LIGHT_BG : WHITE;
    return [
      { text: team.name, options: { fontSize: 10, fill: { color: bg }, color: "333333" } },
      { text: `${cnt}`, options: { fontSize: 10, fill: { color: bg }, color: "333333", align: "center" } },
      { text: `${ap}%`, options: { fontSize: 10, fill: { color: bg }, color: AMBER, bold: true, align: "center" } },
      { text: `${aa}%`, options: { fontSize: 10, fill: { color: bg }, color: BLUE, bold: true, align: "center" } },
      { text: `${g > 0 ? "+" : ""}${g}%p`, options: { fontSize: 10, fill: { color: bg }, color: g >= 0 ? GREEN : RED, bold: true, align: "center" } },
    ];
  });
  slide3.addTable([tpTableHeader, ...tpTableRows], {
    x: 0.5, y: 1.1, w: 9.0, colW: [3.0, 1.5, 1.5, 1.5, 1.5],
    border: { type: "solid", pt: 0.5, color: "DDDDDD" },
    rowH: 0.45,
  });

  // === Slide 4: Behind Schedule ===
  const slide4 = pptx.addSlide();
  slide4.background = { color: WHITE };
  slide4.addText("Behind Schedule Tasks", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: NAVY, fontFace: "Arial" });

  const behindTasks = tasks
    .map(t => ({ ...t, planned: calcPlannedProgress(t.start_date, t.end_date), gap: t.current_progress - calcPlannedProgress(t.start_date, t.end_date) }))
    .filter(t => t.gap < 0 && t.current_progress < 100)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 12);

  const bsHeader: PptxGenJS.TableRow = [
    { text: "Task Code", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Title", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Assignee", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Plan", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Actual", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Gap", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
  ];
  const bsRows: PptxGenJS.TableRow[] = behindTasks.map((t, i) => {
    const bg = i % 2 === 0 ? LIGHT_BG : WHITE;
    return [
      { text: t.task_code ?? "", options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
      { text: t.title, options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
      { text: memberName(members, t.assignee_id), options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
      { text: `${t.planned}%`, options: { fontSize: 8, fill: { color: bg }, color: AMBER, align: "center" } },
      { text: `${t.current_progress}%`, options: { fontSize: 8, fill: { color: bg }, color: BLUE, align: "center" } },
      { text: `${t.gap}%p`, options: { fontSize: 8, fill: { color: bg }, color: RED, bold: true, align: "center" } },
    ];
  });
  if (bsRows.length === 0) {
    slide4.addText("No behind-schedule tasks 🎉", { x: 1, y: 2.5, w: 8, h: 1, fontSize: 18, color: GREEN, align: "center" });
  } else {
    slide4.addTable([bsHeader, ...bsRows], {
      x: 0.3, y: 1.1, w: 9.4, colW: [1.8, 2.8, 1.5, 1.0, 1.0, 1.0],
      border: { type: "solid", pt: 0.5, color: "DDDDDD" },
      rowH: 0.35,
    });
  }

  // === Slide 5: Critical Issues ===
  const slide5 = pptx.addSlide();
  slide5.background = { color: WHITE };
  slide5.addText("Critical Issues", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: NAVY, fontFace: "Arial" });

  const issueTasks = tasks.filter(t => t.issue_flag !== "normal").slice(0, 12);
  const ciHeader: PptxGenJS.TableRow = [
    { text: "Task Code", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Title", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
    { text: "Flag", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Issue Type", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } },
    { text: "Description", options: { fontSize: 9, bold: true, color: WHITE, fill: { color: NAVY } } },
  ];
  const ciRows: PptxGenJS.TableRow[] = issueTasks.map((t, i) => {
    const bg = i % 2 === 0 ? LIGHT_BG : WHITE;
    const flagColor = t.issue_flag === "critical" ? RED : AMBER;
    return [
      { text: t.task_code ?? "", options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
      { text: t.title, options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
      { text: t.issue_flag.toUpperCase(), options: { fontSize: 8, fill: { color: bg }, color: flagColor, bold: true, align: "center" } },
      { text: t.issue_type ?? "", options: { fontSize: 8, fill: { color: bg }, color: "333333", align: "center" } },
      { text: t.issue_description ?? "", options: { fontSize: 8, fill: { color: bg }, color: "333333" } },
    ];
  });
  if (ciRows.length === 0) {
    slide5.addText("No active issues 🎉", { x: 1, y: 2.5, w: 8, h: 1, fontSize: 18, color: GREEN, align: "center" });
  } else {
    slide5.addTable([ciHeader, ...ciRows], {
      x: 0.3, y: 1.1, w: 9.4, colW: [1.6, 2.0, 1.0, 1.2, 3.6],
      border: { type: "solid", pt: 0.5, color: "DDDDDD" },
      rowH: 0.35,
    });
  }

  await pptx.writeFile({ fileName: `ALSMK_Report_${dateStr()}.pptx` });
}
