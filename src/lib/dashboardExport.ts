import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";
import { differenceInCalendarDays, startOfDay, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────

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

// ─── PowerPoint Export (html2canvas capture) ────────────────

const SECTION_LABELS: Record<string, string> = {
  "milestone-timeline": "Milestone Timeline",
  "project-hud": "Project HUD (KPI)",
  "team-progress": "Team Progress",
  "category-progress": "Category Progress",
  "behind-schedule": "Behind Schedule",
  "critical-issues": "Critical Issues",
  "upcoming-deadlines": "Upcoming Deadlines",
  "issue-trend": "Issue Trend",
  "team-heatmap": "Team Heatmap",
  "part-status": "Part Status Board",
};

const NAVY = "00205B";
const BLUE = "1B69B5";
const WHITE = "FFFFFF";
const GREEN = "16A34A";
const AMBER = "D97706";
const RED = "DC2626";

async function captureElement(exportId: string): Promise<string | null> {
  const el = document.querySelector(`[data-export-id="${exportId}"]`) as HTMLElement | null;
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error(`Failed to capture ${exportId}:`, err);
    return null;
  }
}

export async function exportDashboardPptxWithCaptures(selectedSections: string[]) {
  const { tasks } = await fetchDashboardData();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "ALSMK Project";

  // === Slide 1: Title + KPI ===
  const totalTasks = tasks.length;
  const avgActual = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgPlanned = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks) : 0;
  const gap = avgActual - avgPlanned;
  const completed = tasks.filter(t => t.current_progress >= 100).length;
  const inProgress = tasks.filter(t => t.current_progress > 0 && t.current_progress < 100).length;
  const notStarted = tasks.filter(t => t.current_progress === 0).length;

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

  // === Capture and add section slides ===
  // Pair small sections side-by-side, full-width for large ones
  const FULL_WIDTH_SECTIONS = new Set([
    "milestone-timeline", "project-hud", "team-heatmap", "part-status",
  ]);

  const fullSections: string[] = [];
  const halfSections: string[] = [];

  for (const id of selectedSections) {
    if (FULL_WIDTH_SECTIONS.has(id)) {
      fullSections.push(id);
    } else {
      halfSections.push(id);
    }
  }

  // Process full-width sections (1 per slide)
  for (const sectionId of fullSections) {
    const imgData = await captureElement(sectionId);
    if (!imgData) continue;

    const slide = pptx.addSlide();
    slide.background = { color: "1A1F2E" };
    slide.addText(SECTION_LABELS[sectionId] ?? sectionId, {
      x: 0.5, y: 0.2, w: 9, h: 0.5,
      fontSize: 20, bold: true, color: WHITE, fontFace: "Arial",
    });
    slide.addImage({
      data: imgData,
      x: 0.3, y: 0.8, w: 9.4, h: 4.5,
      sizing: { type: "contain", w: 9.4, h: 4.5 },
    });
  }

  // Process half-width sections (2 per slide)
  for (let i = 0; i < halfSections.length; i += 2) {
    const slide = pptx.addSlide();
    slide.background = { color: "1A1F2E" };

    const leftId = halfSections[i];
    const rightId = halfSections[i + 1];

    // Left
    const leftImg = await captureElement(leftId);
    if (leftImg) {
      slide.addText(SECTION_LABELS[leftId] ?? leftId, {
        x: 0.3, y: 0.2, w: 4.5, h: 0.5,
        fontSize: 16, bold: true, color: WHITE, fontFace: "Arial",
      });
      slide.addImage({
        data: leftImg,
        x: 0.3, y: 0.8, w: 4.5, h: 4.5,
        sizing: { type: "contain", w: 4.5, h: 4.5 },
      });
    }

    // Right
    if (rightId) {
      const rightImg = await captureElement(rightId);
      if (rightImg) {
        slide.addText(SECTION_LABELS[rightId] ?? rightId, {
          x: 5.2, y: 0.2, w: 4.5, h: 0.5,
          fontSize: 16, bold: true, color: WHITE, fontFace: "Arial",
        });
        slide.addImage({
          data: rightImg,
          x: 5.2, y: 0.8, w: 4.5, h: 4.5,
          sizing: { type: "contain", w: 4.5, h: 4.5 },
        });
      }
    }
  }

  await pptx.writeFile({ fileName: `ALSMK_Report_${dateStr()}.pptx` });
}

// Keep legacy export for backward compatibility
export { exportDashboardPptxWithCaptures as exportDashboardPptx };
