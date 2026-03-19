import { useState } from "react";
import { TaskTable } from "@/components/tasks/TaskTable";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, ListTree, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const Workspace = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, memberId } = useAuthContext();
  const [filterMode, setFilterMode] = useState<"mine" | "team">("mine");
  const [generating, setGenerating] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);

  const { data: myMember } = useQuery({
    queryKey: ["my_member", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data, error } = await supabase
        .from("members")
        .select("is_pm")
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
    staleTime: 30_000,
  });

  const isPm = myMember?.is_pm ?? false;
  const isAdminOrPm = isAdmin || isPm;
  const showTabs = !isAdmin && !isPm;

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("title").order("start_date").order("end_date");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
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

        // Team & part: use first subtask's
        const teamId = groupTasks[0].team_id;
        const partId = groupTasks[0].part_id;

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

  const handleExport = () => {
    const getMemberName = (id: string | null) => !id ? "" : members.find(m => m.id === id)?.name ?? "";

    const rows = tasks.map(t => {
      const isSummary = (t as any).is_summary;
      const planned = calcPlannedProgress(t.start_date, t.end_date);
      const gap = t.current_progress - planned;
      const remaining = t.actual_finish ? 0 : differenceInCalendarDays(parseLocalDate(t.end_date), startOfDay(new Date()));
      const dDay = t.actual_finish ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`;

      return {
        "Type": isSummary ? "Summary" : (t as any).parent_id ? "  └ Subtask" : "Task",
        "assignee": getMemberName(t.assignee_id),
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
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Action Plan");
    XLSX.writeFile(wb, `ALSMK_Tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground">Your assigned tasks and progress</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerateSummaries} disabled={generating}>
            <ListTree className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : isAdminOrPm ? "Generate Summaries" : "Generate Summaries (내 태스크)"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/tasks/import")}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <AddTaskDialog />
        </div>
      </div>

      {showTabs && (
        <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as "mine" | "team")}>
          <TabsList>
            <TabsTrigger value="mine">내 태스크</TabsTrigger>
            <TabsTrigger value="team">팀 태스크</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <TaskTable filterMine filterMode={showTabs ? filterMode : undefined} />
    </div>
  );
};

export default Workspace;
