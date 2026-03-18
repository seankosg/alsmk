import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

export function CriticalIssueBoard() {
  const { isAdmin, memberId } = useAuthContext();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: tasks = [], isLoading: lt } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
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

  const issues = tasks
    .filter(t => t.issue_flag !== "normal")
    .sort((a, b) => (a.issue_flag === "critical" ? -1 : 1));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critical Issues ({issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lt ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {issues.length === 0 && (
                <p className="text-sm text-muted-foreground">No active issues</p>
              )}
              {issues.map((task) => {
                const planned = calcPlannedProgress(task.start_date, task.end_date);
                const gap = task.current_progress - planned;
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs text-muted-foreground">{task.task_code}</code>
                        <Badge variant={task.issue_flag === "critical" ? "destructive" : "outline"} className={task.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                          {task.issue_flag}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{getMemberName(task.assignee_id)}</p>
                      {task.issue_description && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{task.issue_description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-mono font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {gap >= 0 ? '+' : ''}{gap}%
                      </span>
                      <p className="text-[10px] text-muted-foreground">Gap</p>
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
        readOnly={!isAdmin && selectedTask?.assignee_id !== memberId}
      />
    </>
  );
}
