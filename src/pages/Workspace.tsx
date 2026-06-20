import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { TaskTable } from "@/components/tasks/TaskTable";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { DeletedTasksList } from "@/components/tasks/DeletedTasksList";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, ListTree, ChevronsUpDown, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress, weightedAvg } from "@/lib/mockData";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import XLSX from "xlsx-js-style";
import {
  STYLE_TITLE,
  STYLE_META_LABEL,
  STYLE_META_VALUE,
  STYLE_HEADER,
  STYLE_DATA,
  STYLE_DATA_CENTER,
  STYLE_DATA_RIGHT,
  STYLE_SUMMARY,
  STYLE_SUMMARY_CENTER,
  STYLE_SUMMARY_RIGHT,
  STYLE_GAP_POS,
  STYLE_GAP_NEG,
  PCT_NUMFMT,
  setCell,
  setNumberCell,
  setDateCell,
  isoToExcelSerial,
  timestampForFilename,
  exportedTimestamp,
} from "@/lib/excelStyles";

const Workspace = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isAdmin, isPm, isAdminOrPm, readOnly, memberId } = useAuthContext();
  const [filterMode, setFilterMode] = useState<"mine" | "team" | "project">("mine");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [deepLinkTask, setDeepLinkTask] = useState<any>(null);
  const highlightTaskId = searchParams.get("task");


  // Scroll to highlighted task
  useEffect(() => {
    if (!highlightTaskId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${highlightTaskId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        }, 3000);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [highlightTaskId]);

  const showTabs = !isAdminOrPm;

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("deleted_at", null).order("title").order("start_date").order("end_date");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Deep-link: open TaskDetailDialog when ?task= param is present
  useEffect(() => {
    if (!highlightTaskId || tasks.length === 0) return;
    const found = tasks.find((t) => t.id === highlightTaskId);
    if (found) {
      setDeepLinkTask(found);
    }
  }, [highlightTaskId, tasks]);

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const handleGenerateSummaries = async () => {
    setGenerating(true);
    try {
      // Get all non-summary tasks, scoped by role
      let subtasks = tasks.filter(t => !(t as any).is_summary);
      if (!isAdminOrPm) {
        subtasks = subtasks.filter(t => t.assignee_id === memberId);
      }

      // Group by title
      const groups = new Map<string, typeof subtasks>();
      for (const t of subtasks) {
        if (!groups.has(t.title)) groups.set(t.title, []);
        groups.get(t.title)!.push(t);
      }

      let created = 0;
      let updated = 0;

      for (const [title, groupTasks] of groups) {
        if (groupTasks.length < 2) continue;

        // Calculate summary values
        const startDate = groupTasks.reduce((min, t) => t.start_date < min ? t.start_date : min, groupTasks[0].start_date);
        const endDate = groupTasks.reduce((max, t) => t.end_date > max ? t.end_date : max, groupTasks[0].end_date);

        // Duration-weighted average for actual progress (MS Project logic)
        let totalDuration = 0;
        let weightedProgress = 0;
        for (const t of groupTasks) {
          const dur = Math.max(1, differenceInCalendarDays(parseLocalDate(t.end_date), parseLocalDate(t.start_date)) + 1);
          totalDuration += dur;
          weightedProgress += t.current_progress * dur;
        }
        const actualProgress = totalDuration > 0 ? Math.round(weightedProgress / totalDuration) : 0;

        // Issue flag: escalate to worst
        const flagPriority = { normal: 0, warning: 1, critical: 2 } as const;
        const worstFlag = groupTasks.reduce((worst, t) => {
          return (flagPriority[t.issue_flag] ?? 0) > (flagPriority[worst] ?? 0) ? t.issue_flag : worst;
        }, "normal" as "normal" | "warning" | "critical");

        // Actual finish: only if ALL subtasks are finished
        const allFinished = groupTasks.every(t => !!t.actual_finish);
        const latestFinish = allFinished
          ? groupTasks.reduce((max, t) => (t.actual_finish! > max ? t.actual_finish! : max), groupTasks[0].actual_finish!)
          : null;

        // Team & part & assignee: use first subtask's (assignee only if all same)
        const teamId = groupTasks[0].team_id;
        const partId = groupTasks[0].part_id;
        const allSameAssignee = groupTasks.every(t => t.assignee_id === groupTasks[0].assignee_id);
        const assigneeId = allSameAssignee ? groupTasks[0].assignee_id : null;

        // Check if summary already exists for this title
        const existingSummary = tasks.find(t => (t as any).is_summary && t.title === title);

        if (existingSummary) {
          // Update existing summary
          const { error } = await supabase.from("tasks").update({
            start_date: startDate,
            end_date: endDate,
            current_progress: actualProgress,
            issue_flag: worstFlag,
            actual_finish: latestFinish,
            assignee_id: assigneeId,
          } as any).eq("id", existingSummary.id);
          if (error) throw error;

          // Ensure subtasks point to this summary
          const subtaskIds = groupTasks.map(t => t.id);
          const { error: linkError } = await supabase.from("tasks").update({
            parent_id: existingSummary.id,
          } as any).in("id", subtaskIds);
          if (linkError) throw linkError;

          // Resequence subtask codes via RPC (TMP suffix 2-pass, UNIQUE 충돌 방지)
          await supabase.rpc("resequence_subtask_codes" as any, {
            _parent_id: existingSummary.id,
          } as any);

          updated++;
        } else {
          // Create new summary task
          const { data: newSummary, error } = await supabase.from("tasks").insert({
            title,
            team_id: teamId,
            part_id: partId,
            assignee_id: assigneeId,
            start_date: startDate,
            end_date: endDate,
            current_progress: actualProgress,
            issue_flag: worstFlag,
            actual_finish: latestFinish,
            is_summary: true,
            action_plan: null,
          } as any).select("id, task_code").single();
          if (error) throw error;

          // Link subtasks
          const subtaskIds = groupTasks.map(t => t.id);
          const { error: linkError } = await supabase.from("tasks").update({
            parent_id: newSummary.id,
          } as any).in("id", subtaskIds);
          if (linkError) throw linkError;

          // Resequence subtask codes via RPC (TMP suffix 2-pass, UNIQUE 충돌 방지)
          await supabase.rpc("resequence_subtask_codes" as any, {
            _parent_id: newSummary.id,
          } as any);

          created++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      if (created === 0 && updated === 0) {
        toast.info("동일한 Subject가 2개 이상인 그룹이 없습니다.");
      } else {
        toast.success(`Summary 생성: ${created}건, 업데이트: ${updated}건`);
      }
    } catch (err: any) {
      toast.error(err.message || "Summary 생성 실패");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const getMemberName = (id: string | null) => !id ? "" : members.find(m => m.id === id)?.name ?? "";
      const userName = memberId ? (members.find(m => m.id === memberId)?.name ?? "Unknown") : "Unknown";
      const userType = isAdmin ? "Admin" : isPm ? "PM" : readOnly ? "Guest" : "Member";

      // Fetch comments with author info
      const { data: allComments = [] } = await supabase
        .from("task_comments")
        .select("task_id, message, author_id, created_at")
        .order("created_at", { ascending: true });

      const commentsByTask = new Map<string, typeof allComments>();
      for (const c of allComments) {
        if (!commentsByTask.has(c.task_id)) commentsByTask.set(c.task_id, []);
        commentsByTask.get(c.task_id)!.push(c);
      }

      // Hierarchical order: Summary → Subtasks, then independent Tasks
      const summaries = tasks.filter(t => t.is_summary).sort((a, b) => (a.task_code ?? "").localeCompare(b.task_code ?? ""));
      const subtasksByParent = new Map<string, typeof tasks>();
      const independentTasks: typeof tasks = [];
      for (const t of tasks) {
        if (t.is_summary) continue;
        if (t.parent_id) {
          if (!subtasksByParent.has(t.parent_id)) subtasksByParent.set(t.parent_id, []);
          subtasksByParent.get(t.parent_id)!.push(t);
        } else {
          independentTasks.push(t);
        }
      }
      independentTasks.sort((a, b) => (a.task_code ?? "").localeCompare(b.task_code ?? ""));

      const ordered: typeof tasks = [];
      for (const s of summaries) {
        ordered.push(s);
        const children = subtasksByParent.get(s.id) ?? [];
        children.sort((a, b) => (a.task_code ?? "").localeCompare(b.task_code ?? ""));
        ordered.push(...children);
      }
      ordered.push(...independentTasks);

      const rows = ordered.map(t => {
        const planned = t.is_summary
          ? weightedAvg(
              tasks.filter(sub => sub.parent_id === t.id && !sub.deleted_at),
              sub => calcPlannedProgress(sub.start_date, sub.end_date)
            )
          : calcPlannedProgress(t.start_date, t.end_date);
        const gap = t.current_progress - planned;
        const isDone = !!t.actual_finish || t.current_progress >= 100;
        const remaining = isDone ? 0 : differenceInCalendarDays(parseLocalDate(t.end_date), startOfDay(new Date()));
        const dDay = isDone ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`;

        const taskComments = commentsByTask.get(t.id) ?? [];
        const commentsStr = taskComments.map(c => {
          const authorName = getMemberName(c.author_id);
          const date = new Date(c.created_at).toLocaleDateString("ko-KR");
          return `${authorName} (${date}): ${c.message}`;
        }).join("\n");

        return {
          type: t.is_summary ? "Summary" : t.parent_id ? "Subtask" : "Task",
          typeLabel: t.is_summary ? "Summary" : t.parent_id ? "  └ Subtask" : "Task",
          taskCode: t.task_code ?? "",
          assignee: getMemberName(t.assignee_id),
          category: t.category ?? "",
          subject: t.title,
          actionPlan: t.action_plan ?? "",
          start: t.start_date,
          finish: t.end_date,
          dDay,
          planned,
          actual: t.current_progress,
          gap,
          actualFinish: t.actual_finish ?? "",
          comments: commentsStr,
          isSummary: !!t.is_summary,
        };
      });

      // ── Build styled workbook ──────────────────────────────
      const HEADERS = [
        "Type", "Task Code", "Assignee", "Category", "Subject", "Action Plan",
        "Start", "Finish", "D-Day", "Plan %", "Actual %", "Gap %p", "Actual Finish", "Comments",
      ];
      const COL_WIDTHS = [11, 18, 14, 14, 38, 34, 12, 12, 9, 9, 9, 10, 13, 50];
      const colCount = HEADERS.length;

      const summaryCount = rows.filter(r => r.type === "Summary").length;
      const subtaskCount = rows.filter(r => r.type === "Subtask").length;
      const taskCount = rows.filter(r => r.type === "Task").length;

      const META_LINES: string[] = [
        "ALSMK Project — My Workspace Tasks Export",
        `Exported: ${exportedTimestamp()}  by  ${userName} (${userType})`,
        `Source: My Workspace${filterMode === "mine" ? " (Mine)" : filterMode === "team" ? " (Team)" : " (Project)"}`,
        `Search: (none)`,
        `Filters: (current view)`,
        `Totals: ${rows.length} rows  ·  Summary ${summaryCount} / Subtask ${subtaskCount} / Task ${taskCount}`,
      ];

      // Build empty AOA scaffold so cols/merges/rows/freeze get a valid ref.
      const HEADER_ROW = 7; // 0-indexed (rows 0..5 meta, 6 blank, 7 header)
      const DATA_START = 8;
      const aoa: any[][] = [];
      for (let i = 0; i < META_LINES.length; i++) aoa.push([META_LINES[i]]);
      aoa.push([]); // blank row 6
      aoa.push(HEADERS);
      for (let i = 0; i < rows.length; i++) aoa.push(new Array(colCount).fill(""));

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Merge meta rows across all columns
      const merges: XLSX.Range[] = [];
      for (let r = 0; r < META_LINES.length; r++) {
        merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } });
      }
      ws["!merges"] = merges;

      // Column widths
      ws["!cols"] = COL_WIDTHS.map(w => ({ wch: w }));

      // Row heights
      const rowsInfo: XLSX.RowInfo[] = [];
      rowsInfo[0] = { hpt: 24 };
      for (let i = 1; i <= 5; i++) rowsInfo[i] = { hpt: 16 };
      rowsInfo[6] = { hpt: 6 };
      rowsInfo[HEADER_ROW] = { hpt: 28 };
      for (let i = 0; i < rows.length; i++) rowsInfo[DATA_START + i] = { hpt: 20 };
      ws["!rows"] = rowsInfo;

      // Freeze panes: lock title/meta/header + first 3 columns
      const xSplit = 3;
      const ySplit = DATA_START;
      ws["!freeze"] = { xSplit, ySplit };
      (ws as any)["!views"] = [{
        state: "frozen",
        xSplit,
        ySplit,
        topLeftCell: XLSX.utils.encode_cell({ r: ySplit, c: xSplit }),
        activePane: "bottomRight",
      }];

      // Style: title + meta
      setCell(ws, 0, 0, META_LINES[0], STYLE_TITLE);
      for (let r = 1; r <= 5; r++) {
        setCell(ws, r, 0, META_LINES[r], r === 1 ? STYLE_META_LABEL : STYLE_META_VALUE);
      }
      // Header
      for (let c = 0; c < HEADERS.length; c++) {
        setCell(ws, HEADER_ROW, c, HEADERS[c], STYLE_HEADER);
      }

      // Data rows
      rows.forEach((row, i) => {
        const r = DATA_START + i;
        const baseText = row.isSummary ? STYLE_SUMMARY : STYLE_DATA;
        const baseCenter = row.isSummary ? STYLE_SUMMARY_CENTER : STYLE_DATA_CENTER;
        const baseRight = row.isSummary ? STYLE_SUMMARY_RIGHT : STYLE_DATA_RIGHT;

        setCell(ws, r, 0, row.typeLabel, baseText);
        setCell(ws, r, 1, row.taskCode, baseText);
        setCell(ws, r, 2, row.assignee, baseText);
        setCell(ws, r, 3, row.category, baseText);
        setCell(ws, r, 4, row.subject, baseText);
        setCell(ws, r, 5, row.actionPlan, baseText);

        const sSerial = isoToExcelSerial(row.start);
        if (sSerial != null) setDateCell(ws, r, 6, sSerial, baseCenter);
        else setCell(ws, r, 6, row.start, baseCenter);

        const fSerial = isoToExcelSerial(row.finish);
        if (fSerial != null) setDateCell(ws, r, 7, fSerial, baseCenter);
        else setCell(ws, r, 7, row.finish, baseCenter);

        setCell(ws, r, 8, row.dDay, baseCenter);

        setNumberCell(ws, r, 9, row.planned, PCT_NUMFMT, baseRight);
        setNumberCell(ws, r, 10, row.actual, PCT_NUMFMT, baseRight);

        // Gap with color
        const gapStyle = row.isSummary
          ? baseRight
          : row.gap >= 0 ? STYLE_GAP_POS : STYLE_GAP_NEG;
        setNumberCell(ws, r, 11, row.gap, PCT_NUMFMT, gapStyle);

        if (row.actualFinish) {
          const afSerial = isoToExcelSerial(row.actualFinish);
          if (afSerial != null) setDateCell(ws, r, 12, afSerial, baseCenter);
          else setCell(ws, r, 12, row.actualFinish, baseCenter);
        } else {
          setCell(ws, r, 12, "", baseCenter);
        }

        setCell(ws, r, 13, row.comments, baseText);
      });

      const lastColLetter = XLSX.utils.encode_col(colCount - 1);
      const lastRow = DATA_START + rows.length - 1;
      ws["!ref"] = `A1:${lastColLetter}${Math.max(lastRow + 1, DATA_START)}`;

      // AutoFilter on header row
      ws["!autofilter"] = { ref: `A${HEADER_ROW + 1}:${lastColLetter}${HEADER_ROW + 1}` };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Action Plan");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ALSMK_Workspace_Tasks_${timestampForFilename()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Excel 파일이 다운로드되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "Export 실패");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="light-scope flex flex-col h-full overflow-hidden gap-4 -m-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground">Your assigned tasks and progress</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button variant="outline" onClick={handleGenerateSummaries} disabled={generating}>
              <ListTree className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : isAdminOrPm ? "Generate Summaries" : "Generate Summaries (내 태스크)"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setAllCollapsed(prev => !prev)}
          >
            <ChevronsUpDown className="mr-2 h-4 w-4" />
            {allCollapsed ? "Expand All" : "Collapse All"}
          </Button>
          {!readOnly && (
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <Trash2 className="mr-2 h-4 w-4" /> Trash
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>휴지통</SheetTitle>
                  </SheetHeader>
                  <DeletedTasksList />
                </SheetContent>
              </Sheet>
              <Button variant="outline" onClick={() => navigate("/tasks/import")}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <FileDown className="mr-2 h-4 w-4" /> {exporting ? "Exporting..." : "Export"}
          </Button>
          {!readOnly && <AddTaskDialog />}
        </div>
      </div>

      {showTabs && (
        <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as "mine" | "team" | "project")}>
          <TabsList>
            <TabsTrigger value="mine">내 태스크</TabsTrigger>
            <TabsTrigger value="team">팀 태스크</TabsTrigger>
            <TabsTrigger value="project">프로젝트 태스크</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="flex-1 min-h-0">
        <TaskTable filterMine filterMode={showTabs ? filterMode : undefined} allCollapsed={allCollapsed} />
      </div>

      {/* Deep-link TaskDetailDialog */}
      <TaskDetailDialog
        task={deepLinkTask}
        open={!!deepLinkTask}
        onOpenChange={(open) => {
          if (!open) {
            setDeepLinkTask(null);
            searchParams.delete("task");
            navigate({ search: searchParams.toString() }, { replace: true });
          }
        }}
        teams={teams}
        members={members}
        milestones={milestones}
        allTasks={tasks}
      />
    </div>
  );
};

export default Workspace;
