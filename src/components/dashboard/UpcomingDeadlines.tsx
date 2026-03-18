import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { differenceInDays, parseISO } from "date-fns";
import { Clock, AlertTriangle } from "lucide-react";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

export function UpcomingDeadlines() {
  const { isAdmin } = useAuthContext();
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
      const { data, error } = await supabase.from("members").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const now = new Date();
  const upcoming = tasks
    .filter((t) => {
      const end = parseISO(t.end_date);
      const days = differenceInDays(end, now);
      return days >= 0 && days <= 7 && t.current_progress < 100;
    })
    .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());

  const getTeamCode = (teamId: string) => teams.find((t) => t.id === teamId)?.code ?? "";
  const getMemberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Tasks due within 7 days</p>
        </CardHeader>
        <CardContent>
          {lt ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto scrollbar-thin">
              {upcoming.map((task) => {
                const daysLeft = differenceInDays(parseISO(task.end_date), now);
                const isAtRisk = task.current_progress < 70;
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`rounded-lg border p-3 transition-colors cursor-pointer hover:ring-1 hover:ring-primary/40 ${
                      isAtRisk
                        ? "border-warning/40 bg-warning/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.action_plan && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.action_plan}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {getTeamCode(task.team_id)} · {task.task_code ?? "—"}
                          {getMemberName(task.assignee_id) && ` · ${getMemberName(task.assignee_id)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isAtRisk && <AlertTriangle className="h-3 w-3 text-warning" />}
                        <span
                          className={`text-xs font-mono font-semibold ${
                            daysLeft <= 2 ? "text-destructive" : daysLeft <= 5 ? "text-warning" : "text-muted-foreground"
                          }`}
                        >
                          D-{daysLeft}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={task.current_progress}
                        className={`h-1.5 flex-1 ${isAtRisk ? "[&>div]:bg-warning" : "[&>div]:bg-primary"}`}
                      />
                      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                        {task.current_progress}%
                      </span>
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
        readOnly={!isAdmin}
      />
    </>
  );
}
