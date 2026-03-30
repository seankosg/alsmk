import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from "recharts";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { QueryErrorCard } from "./QueryErrorCard";

const chartConfig = {
  planned: { label: "Planned", color: "hsl(var(--muted-foreground))" },
  actual: { label: "Actual", color: "hsl(var(--primary))" },
};

export function TeamProgressChart() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [selectedTeam, setSelectedTeam] = useState<{ code: string; id: string; name: string } | null>(null);
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

  const { data: tasks = [], isLoading: ltt, isError: ett } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (et || ett) {
    return <QueryErrorCard title="Team Progress" onRetry={() => rt()} />;
  }

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

  const chartData = teams.map((team) => {
    const teamTasks = tasks.filter((t) => t.team_id === team.id && !t.is_summary);
    const avgActual =
      teamTasks.length > 0
        ? Math.round(teamTasks.reduce((s, t) => s + t.current_progress, 0) / teamTasks.length)
        : 0;
    const avgPlanned =
      teamTasks.length > 0
        ? Math.round(
            teamTasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) /
              teamTasks.length
          )
        : 0;
    const gap = avgActual - avgPlanned;
    return { name: team.code, planned: avgPlanned, actual: avgActual, gap, teamId: team.id, teamName: team.name };
  });

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const d = data.activePayload[0].payload;
      const team = teams.find(t => t.id === d.teamId);
      if (team) setSelectedTeam({ code: team.code, id: team.id, name: team.name });
    }
  };

  const renderPlannedLabel = (props: any) => {
    const { x, y, width, value } = props;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
        {value}%
      </text>
    );
  };

  const renderActualLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    const entry = chartData[index];
    const gap = entry?.gap ?? 0;
    const gapColor = gap >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))";
    const gapText = gap >= 0 ? `+${gap}%p` : `${gap}%p`;
    return (
      <g>
        <text x={x + width / 2} y={y - 20} textAnchor="middle" fontSize={10} fontWeight={600} fill={gapColor}>
          {gapText}
        </text>
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
          {value}%
        </text>
      </g>
    );
  };

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  // All tasks for selected team (excluding summary)
  const allTeamTasks = selectedTeam
    ? tasks
        .filter(t => t.team_id === selectedTeam.id && !t.is_summary)
        .map(t => {
          const planned = calcPlannedProgress(t.start_date, t.end_date);
          return { ...t, planned, gap: t.current_progress - planned };
        })
        .sort((a, b) => a.gap - b.gap)
    : [];

  const teamAvgPlanned = allTeamTasks.length > 0
    ? Math.round(allTeamTasks.reduce((s, t) => s + t.planned, 0) / allTeamTasks.length)
    : 0;
  const teamAvgActual = allTeamTasks.length > 0
    ? Math.round(allTeamTasks.reduce((s, t) => s + t.current_progress, 0) / allTeamTasks.length)
    : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team Progress</CardTitle>
          <p className="text-xs text-muted-foreground">Planned vs Actual by team — click a bar to drill down</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={chartData} barGap={2} barCategoryGap="20%" onClick={handleBarClick} style={{ cursor: "pointer" }} margin={{ top: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-xs fill-muted-foreground"
                  width={40}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
                />
                <Bar
                  dataKey="planned"
                  fill="hsl(var(--muted-foreground) / 0.3)"
                  radius={[4, 4, 0, 0]}
                  name="Planned"
                >
                  <LabelList dataKey="planned" content={renderPlannedLabel} />
                </Bar>
                <Bar
                  dataKey="actual"
                  radius={[4, 4, 0, 0]}
                  name="Actual"
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill="hsl(var(--primary))"
                    />
                  ))}
                  <LabelList dataKey="actual" content={renderActualLabel} />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Team drilldown dialog */}
      <Dialog open={!!selectedTeam && !selectedTask} onOpenChange={(open) => { if (!open) setSelectedTeam(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedTeam?.name} ({selectedTeam?.code}) — Task Progress
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {allTeamTasks.length}개 태스크 | 평균 Plan {teamAvgPlanned}% / Actual {teamAvgActual}%
            </p>
          </DialogHeader>
          <div className="space-y-2">
            {allTeamTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks found.</p>}
            {allTeamTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
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
