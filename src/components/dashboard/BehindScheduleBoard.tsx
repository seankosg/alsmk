import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

export function BehindScheduleBoard() {
  const { isAdmin, memberId } = useAuthContext();
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
      const { data, error } = await supabase.from("tasks").select("*");
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

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  // All behind-schedule tasks grouped by team
  const behindTasks = tasks
    .map(t => {
      const planned = calcPlannedProgress(t.start_date, t.end_date);
      return { ...t, planned, gap: t.current_progress - planned };
    })
    .filter(t => t.gap < 0)
    .sort((a, b) => a.gap - b.gap);

  const groupedByTeam = teams
    .map(team => ({
      team,
      tasks: behindTasks.filter(t => t.team_id === team.id),
    }))
    .filter(g => g.tasks.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Behind Schedule ({behindTasks.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Auto-detected: Actual % &lt; Planned %, grouped by team</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : groupedByTeam.length === 0 ? (
            <p className="text-sm text-muted-foreground">All tasks are on schedule 🎉</p>
          ) : (
            <div className="space-y-2">
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
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{getMemberName(t.assignee_id)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-mono font-bold text-destructive">{t.gap}%</span>
                          <p className="text-[10px] text-muted-foreground">Plan {t.planned}% / Actual {t.current_progress}%</p>
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
        readOnly={!isAdmin && selectedTask?.assignee_id !== memberId}
      />
    </>
  );
}
