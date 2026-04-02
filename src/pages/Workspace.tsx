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
import * as XLSX from "xlsx";

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

          // Update subtask codes to hierarchical format
          const summaryCode = existingSummary.task_code;
          if (summaryCode) {
            for (let i = 0; i < subtaskIds.length; i++) {
              await supabase.from("tasks").update({
                task_code: summaryCode + "-" + String(i + 1).padStart(2, "0"),
              } as any).eq("id", subtaskIds[i]);
            }
          }

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

          // Update subtask codes to hierarchical format
          const summaryCode = newSummary.task_code;
          if (summaryCode) {
            for (let i = 0; i < subtaskIds.length; i++) {
              await supabase.from("tasks").update({
                task_code: summaryCode + "-" + String(i + 1).padStart(2, "0"),
              } as any).eq("id", subtaskIds[i]);
            }
          }

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

      // Fetch comments with author info
      const { data: allComments = [] } = await supabase
        .from("task_comments")
        .select("task_id, message, author_id, created_at")
        .order("created_at", { ascending: true });

      // Group comments by task_id
      const commentsByTask = new Map<string, typeof allComments>();
      for (const c of allComments) {
        if (!commentsByTask.has(c.task_id)) commentsByTask.set(c.task_id, []);
        commentsByTask.get(c.task_id)!.push(c);
      }

      // Build hierarchical order: Summary → its Subtasks, then independent Tasks
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
        const remaining = t.actual_finish ? 0 : differenceInCalendarDays(parseLocalDate(t.end_date), startOfDay(new Date()));
        const dDay = t.actual_finish ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`;

        // Format comments
        const taskComments = commentsByTask.get(t.id) ?? [];
        const commentsStr = taskComments.map(c => {
          const authorName = getMemberName(c.author_id);
          const date = new Date(c.created_at).toLocaleDateString("ko-KR");
          return `${authorName} (${date}): ${c.message}`;
        }).join("\n");

        return {
          "Type": t.is_summary ? "Summary" : t.parent_id ? "  └ Subtask" : "Task",
          "Task Code": t.task_code ?? "",
          "Assignee": getMemberName(t.assignee_id),
          "Category": t.category ?? "",
          "Subject": t.title,
          "Action Plan": t.action_plan ?? "",
          "Start": t.start_date,
          "Finish": t.end_date,
          "D-Day": dDay,
          "Plan %": planned,
          "Actual %": t.current_progress,
          "차이 %": gap,
          "Actual Finish": t.actual_finish ?? "",
          "Comments": commentsStr,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Action Plan");
      XLSX.writeFile(wb, `ALSMK_Tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel 파일이 다운로드되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "Export 실패");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-4">
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
