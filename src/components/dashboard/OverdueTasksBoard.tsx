import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertOctagon } from "lucide-react";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { differenceInDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export function OverdueTasksBoard() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: tasks = [], isLoading: ltt } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("deleted_at", null);
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

  const isLoading = lt || ltt;
  const now = startOfDay(new Date());

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  const overdueTasks = tasks
    .filter(t => {
      const end = parseLocalDate(t.end_date);
      return end < now && t.current_progress < 100;
    })
    .map(t => {
      const overdueDays = differenceInDays(now, parseLocalDate(t.end_date));
      return { ...t, overdueDays };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const groupedByTeam = teams
    .map(team => ({
      team,
      tasks: overdueTasks.filter(t => t.team_id === team.id),
    }))
    .filter(g => g.tasks.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-destructive" />
            <CardTitle className="text-base">Overdue Tasks ({overdueTasks.length})</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Tasks past due date with progress &lt; 100%, grouped by team</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : groupedByTeam.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue tasks 🎉</p>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin">
              {groupedByTeam.map(({ team, tasks: teamTasks }) => (
                <Collapsible key={team.id} defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
                    <span>{team.name} ({team.code})</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">{teamTasks.length}</Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>svg&]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1 space-y-1.5 pl-1">
                    {teamTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <code className="text-xs text-muted-foreground">{t.task_code}</code>
                            {t.issue_flag !== "normal" && (
                              <Badge variant={t.issue_flag === "critical" ? "destructive" : "outline"} className={t.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                                {t.issue_flag}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 min-w-0">
                            <p className="text-sm font-medium truncate shrink-0 max-w-[40%]">{t.title}</p>
                            {t.action_plan && (
                              <p className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">{t.action_plan}</p>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0 ml-auto">{getMemberName(t.assignee_id)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-mono font-bold text-destructive">D+{t.overdueDays}</span>
                          <p className="text-[10px] text-muted-foreground">Progress {t.current_progress}%</p>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
