import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

export function CriticalIssueBoard() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: tasks = [], isLoading: lt } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*");
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

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  const getTeamCode = (teamId: string) => teams.find(t => t.id === teamId)?.code ?? "";

  const issues = tasks
    .filter(t => t.issue_flag !== "normal")
    .sort((a, b) => (a.issue_flag === "critical" ? -1 : 1));

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critical Issues ({issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lt ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto scrollbar-thin">
              {issues.length === 0 && (
                <p className="text-sm text-muted-foreground">No active issues</p>
              )}
              {issues.map((task) => {
                const planned = calcPlannedProgress(task.start_date, task.end_date);
                const gap = task.current_progress - planned;
                const isCritical = task.issue_flag === "critical";
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`rounded-lg border p-3 transition-colors cursor-pointer hover:ring-1 hover:ring-primary/40 ${
                      isCritical ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <code className="text-xs text-muted-foreground">{getTeamCode(task.team_id)} · {task.task_code ?? "—"}</code>
                          <Badge variant={isCritical ? "destructive" : "outline"} className={task.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                            {task.issue_flag}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <p className="text-sm font-medium truncate flex-1 min-w-0">{task.title}</p>
                          <span className="text-xs text-muted-foreground shrink-0">{getMemberName(task.assignee_id)}</span>
                        </div>
                        {task.action_plan && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{task.action_plan}</p>
                        )}
                        {task.issue_description && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{task.issue_description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={task.current_progress}
                            className="h-1.5 flex-1 [&>div]:bg-primary"
                          />
                          <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                            {task.current_progress}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-sm font-mono font-bold ${gap >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {gap >= 0 ? '+' : ''}{gap}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">Plan {planned}% / Actual {task.current_progress}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        teams={teams}
        members={members}
        milestones={milestones}
        readOnly={!isAdminOrPm && selectedTask?.assignee_id !== memberId}
      />
    </>
  );
}
