import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { QueryErrorCard } from "./QueryErrorCard";

export function TeamHeatmap() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [selectedPart, setSelectedPart] = useState<{ id: string; name: string; teamName: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: teams = [], isLoading: lt, isError: et, refetch: rt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: parts = [], isLoading: lp } = useQuery({
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

  const isLoading = lt || lp || ltt;

  if (et) {
    return <QueryErrorCard title="Team Heatmap" onRetry={() => rt()} />;
  }

  const getGapColor = (avgGap: number) => {
    if (avgGap >= 0) return "bg-success/20 border-success/40 text-success";
    return "bg-destructive/20 border-destructive/40 text-destructive";
  };

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  const getTeamCode = (teamId: string) => teams.find(t => t.id === teamId)?.code ?? "";

  // Tasks for selected part drilldown
  const partTasks = selectedPart
    ? tasks
        .filter(t => t.part_id === selectedPart.id)
        .map(t => {
          const planned = calcPlannedProgress(t.start_date, t.end_date);
          return { ...t, planned, gap: t.current_progress - planned };
        })
        .sort((a, b) => a.gap - b.gap)
    : [];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team Heatmap — Gap Analysis</CardTitle>
          <p className="text-xs text-muted-foreground">Part colors based on Planned vs Actual gap. Click a part to drill down.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => {
                const teamParts = parts.filter(p => p.team_id === team.id);
                return (
                  <div key={team.id}>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{team.name} ({team.code})</p>
                    <div className="flex flex-wrap gap-2">
                      {teamParts.map((part) => {
                        const partTasks = tasks.filter(t => t.part_id === part.id);
                        const avgGap = partTasks.length > 0
                          ? Math.round(partTasks.reduce((s, t) => s + (t.current_progress - calcPlannedProgress(t.start_date, t.end_date)), 0) / partTasks.length)
                          : 0;
                        const behindCount = partTasks.filter(t => t.current_progress < calcPlannedProgress(t.start_date, t.end_date)).length;
                        return (
                          <div
                            key={part.id}
                            onClick={() => setSelectedPart({ id: part.id, name: part.name, teamName: team.name })}
                            className={`px-3 py-2 rounded-md border text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getGapColor(avgGap)}`}
                          >
                            {part.name}
                            <span className="ml-1.5 font-mono">{avgGap >= 0 ? "+" : ""}{avgGap}%</span>
                            {behindCount > 0 && (
                              <span className="ml-1 opacity-70">({behindCount} behind)</span>
                            )}
                          </div>
                        );
                      })}
                      {teamParts.length === 0 && (
                        <span className="text-xs text-muted-foreground">No parts</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Part drilldown dialog */}
      <Dialog open={!!selectedPart && !selectedTask} onOpenChange={(open) => { if (!open) setSelectedPart(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedPart?.teamName} — {selectedPart?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{partTasks.length} task(s), sorted by gap</p>
          </DialogHeader>
          <div className="space-y-2">
            {partTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks in this part.</p>}
            {partTasks.map((t) => {
              const isHighRisk = t.gap < -10;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className={`rounded-lg border p-3 transition-colors cursor-pointer hover:ring-1 hover:ring-primary/40 ${
                    isHighRisk ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <code className="text-xs text-muted-foreground">{getTeamCode(t.team_id)} · {t.task_code ?? "—"}</code>
                        {t.issue_flag !== "normal" && (
                          <Badge variant={t.issue_flag === "critical" ? "destructive" : "outline"} className={t.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                            {t.issue_flag}
                          </Badge>
                        )}
                        {isHighRisk && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </div>
                      <div className="flex items-baseline gap-2 min-w-0">
                        <p className="text-sm font-medium truncate shrink-0 max-w-[40%]">{t.title}</p>
                        {t.action_plan && (
                          <p className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">{t.action_plan}</p>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0 ml-auto">{getMemberName(t.assignee_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={t.current_progress}
                          className="h-1.5 flex-1 [&>div]:bg-primary"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                          {t.current_progress}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-mono font-bold ${t.gap >= 0 ? "text-success" : "text-destructive"}`}>
                        {t.gap >= 0 ? "+" : ""}{t.gap}%
                      </span>
                      <p className="text-[10px] text-muted-foreground">Plan {t.planned}% / Actual {t.current_progress}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task detail dialog */}
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
