import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Layers } from "lucide-react";
import { calcPlannedProgress } from "@/lib/mockData";
import { differenceInDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

type FilterCategory = "behind" | "upcoming" | "issue";

export function PartStatusBoard() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [drilldown, setDrilldown] = useState<{ partId: string; partName: string; category: FilterCategory } | null>(null);
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

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*");
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
  const now = new Date();

  const getPartStats = (partId: string) => {
    const partTasks = tasks.filter(t => t.part_id === partId);
    const behind = partTasks.filter(t => {
      const planned = calcPlannedProgress(t.start_date, t.end_date);
      return t.current_progress - planned < 0;
    }).length;
    const upcoming = partTasks.filter(t => {
      const days = differenceInDays(parseLocalDate(t.end_date), now);
      return days >= 0 && days <= 7 && t.current_progress < 100;
    }).length;
    const issues = partTasks.filter(t => t.issue_flag !== "normal").length;
    return { behind, upcoming, issues };
  };

  const getFilteredTasks = (partId: string, category: FilterCategory) => {
    const partTasks = tasks.filter(t => t.part_id === partId);
    switch (category) {
      case "behind":
        return partTasks.filter(t => {
          const planned = calcPlannedProgress(t.start_date, t.end_date);
          return t.current_progress - planned < 0;
        });
      case "upcoming":
        return partTasks.filter(t => {
          const days = differenceInDays(parseLocalDate(t.end_date), now);
          return days >= 0 && days <= 7 && t.current_progress < 100;
        });
      case "issue":
        return partTasks.filter(t => t.issue_flag !== "normal");
    }
  };

  const categoryLabel: Record<FilterCategory, string> = {
    behind: "Behind Schedule",
    upcoming: "Upcoming Deadline",
    issue: "Critical / Warning",
  };

  const grouped = teams
    .map(team => ({
      team,
      parts: parts.filter(p => p.team_id === team.id),
    }))
    .filter(g => g.parts.length > 0);

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Team Status Overview</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Behind Schedule · Upcoming D-7 · Issues by Part</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parts configured</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {grouped.map(({ team, parts: teamParts }) => (
                <Collapsible key={team.id} defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
                    <span>{team.name} ({team.code})</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>svg&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1 space-y-1 pl-1">
                    {teamParts.map(part => {
                      const stats = getPartStats(part.id);
                      const hasAny = stats.behind > 0 || stats.upcoming > 0 || stats.issues > 0;
                      return (
                        <div
                          key={part.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30"
                        >
                          <span className="text-sm font-medium truncate">{part.name} <span className="text-muted-foreground text-xs">({part.code})</span></span>
                          {hasAny ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {stats.behind > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="cursor-pointer text-xs px-1.5 py-0"
                                  onClick={() => setDrilldown({ partId: part.id, partName: `${team.code}-${part.code}`, category: "behind" })}
                                >
                                  Behind {stats.behind}
                                </Badge>
                              )}
                              {stats.upcoming > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-warning text-warning cursor-pointer text-xs px-1.5 py-0"
                                  onClick={() => setDrilldown({ partId: part.id, partName: `${team.code}-${part.code}`, category: "upcoming" })}
                                >
                                  D-7 {stats.upcoming}
                                </Badge>
                              )}
                              {stats.issues > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-orange-500 text-orange-500 cursor-pointer text-xs px-1.5 py-0"
                                  onClick={() => setDrilldown({ partId: part.id, partName: `${team.code}-${part.code}`, category: "issue" })}
                                >
                                  Issue {stats.issues}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">OK</span>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown dialog */}
      <Dialog open={!!drilldown} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {drilldown?.partName} — {drilldown && categoryLabel[drilldown.category]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {drilldown && getFilteredTasks(drilldown.partId, drilldown.category).map(task => {
              const planned = calcPlannedProgress(task.start_date, task.end_date);
              const gap = task.current_progress - planned;
              return (
                <div
                  key={task.id}
                  onClick={() => { setDrilldown(null); setSelectedTask(task); }}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <code className="text-xs text-muted-foreground">{task.task_code}</code>
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {members.find(m => m.id === task.assignee_id)?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-mono font-bold ${gap >= 0 ? "text-primary" : "text-destructive"}`}>
                      {gap >= 0 ? "+" : ""}{gap}%
                    </span>
                    <p className="text-[10px] text-muted-foreground">{task.current_progress}% / {planned}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
