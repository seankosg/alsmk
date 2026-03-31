import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from "recharts";
import { calcPlannedProgress, weightedAvg } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { QueryErrorCard } from "./QueryErrorCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, Users } from "lucide-react";

const chartConfig = {
  planned: { label: "Planned", color: "hsl(var(--muted-foreground))" },
  actual: { label: "Actual", color: "hsl(var(--primary))" },
};

type ViewMode = "team" | "individual";

export function TeamProgressChart() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [viewMode, setViewMode] = useState<ViewMode>("team");
  const [selectedTeam, setSelectedTeam] = useState<{ code: string; id: string; name: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
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

  if (et || ett) {
    return <QueryErrorCard title="Team Progress" onRetry={() => rt()} />;
  }

  const isLoading = lt || ltt;
  const nonSummaryTasks = tasks.filter(t => !t.is_summary);

  // Team chart data
  const teamChartData = teams.map((team) => {
    const teamTasks = nonSummaryTasks.filter((t) => t.team_id === team.id);
    const avgActual = weightedAvg(teamTasks, t => t.current_progress);
    const avgPlanned = weightedAvg(teamTasks, t => calcPlannedProgress(t.start_date, t.end_date));
    const gap = avgActual - avgPlanned;
    const behindCount = teamTasks.filter(t => t.current_progress - calcPlannedProgress(t.start_date, t.end_date) < 0).length;
    return { name: team.code, planned: avgPlanned, actual: avgActual, gap, id: team.id, fullName: team.name, behindCount };
  });

  // Individual chart data
  const individualChartData = members
    .map((m) => {
      const memberTasks = nonSummaryTasks.filter(t => t.assignee_id === m.id);
      if (memberTasks.length === 0) return null;
      const avgActual = weightedAvg(memberTasks, t => t.current_progress);
      const avgPlanned = weightedAvg(memberTasks, t => calcPlannedProgress(t.start_date, t.end_date));
      const gap = avgActual - avgPlanned;
      const behindCount = memberTasks.filter(t => t.current_progress - calcPlannedProgress(t.start_date, t.end_date) < 0).length;
      const truncName = m.name.length > 6 ? m.name.slice(0, 6) + "…" : m.name;
      return { name: truncName, planned: avgPlanned, actual: avgActual, gap, id: m.id, fullName: m.name, behindCount };
    })
    .filter(Boolean) as { name: string; planned: number; actual: number; gap: number; id: string; fullName: string; behindCount: number }[];

  const chartData = viewMode === "team" ? teamChartData : individualChartData;

  const handleBarClick = (data: any) => {
    if (!data?.activePayload?.[0]?.payload) return;
    const d = data.activePayload[0].payload;
    if (viewMode === "team") {
      const team = teams.find(t => t.id === d.id);
      if (team) setSelectedTeam({ code: team.code, id: team.id, name: team.name });
    } else {
      setSelectedMember({ id: d.id, name: d.fullName });
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
    const behindCount = entry?.behindCount ?? 0;
    const gapColor = gap >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))";
    const gapText = gap >= 0 ? `+${gap}%p` : `${gap}%p`;
    return (
      <g>
        {behindCount > 0 && (
          <text x={x + width / 2} y={y - 34} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--destructive))">
            ▼{behindCount}
          </text>
        )}
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

  // Drilldown tasks for team
  const drilldownTeamTasks = selectedTeam
    ? nonSummaryTasks
        .filter(t => t.team_id === selectedTeam.id)
        .map(t => { const planned = calcPlannedProgress(t.start_date, t.end_date); return { ...t, planned, gap: t.current_progress - planned }; })
        .sort((a, b) => a.gap - b.gap)
    : [];

  // Drilldown tasks for individual
  const drilldownMemberTasks = selectedMember
    ? nonSummaryTasks
        .filter(t => t.assignee_id === selectedMember.id)
        .map(t => { const planned = calcPlannedProgress(t.start_date, t.end_date); return { ...t, planned, gap: t.current_progress - planned }; })
        .sort((a, b) => a.gap - b.gap)
    : [];

  const activeDrilldown = selectedTeam ? drilldownTeamTasks : drilldownMemberTasks;
  const drilldownTitle = selectedTeam
    ? `${selectedTeam.name} (${selectedTeam.code})`
    : selectedMember?.name ?? "";
  const drilldownAvgPlanned = weightedAvg(activeDrilldown, t => t.planned);
  const drilldownAvgActual = weightedAvg(activeDrilldown, t => t.current_progress);
  const isDrilldownOpen = (!!selectedTeam || !!selectedMember) && !selectedTask;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {viewMode === "team" ? "Team Progress" : "Individual Progress"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Planned vs Actual — click a bar to drill down
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => { if (v) setViewMode(v as ViewMode); }}
              size="sm"
            >
              <ToggleGroupItem value="team" aria-label="Team view">
                <Building2 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="individual" aria-label="Individual view">
                <Users className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (() => {
            const minBarWidth = 60;
            const needsScroll = viewMode === "individual" && chartData.length > 10;
            const dynamicWidth = needsScroll ? chartData.length * minBarWidth : undefined;
            const chartElement = (
              <ChartContainer config={chartConfig} className="h-[280px]" style={dynamicWidth ? { width: dynamicWidth, minWidth: "100%" } : { width: "100%" }}>
                <BarChart data={chartData} barGap={2} barCategoryGap="20%" onClick={handleBarClick} style={{ cursor: "pointer" }} margin={{ top: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" interval={0} angle={viewMode === "individual" && chartData.length > 8 ? -35 : 0} textAnchor={viewMode === "individual" && chartData.length > 8 ? "end" : "middle"} height={viewMode === "individual" && chartData.length > 8 ? 60 : 30} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs fill-muted-foreground" width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                  <Bar dataKey="planned" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="Planned">
                    <LabelList dataKey="planned" content={renderPlannedLabel} />
                  </Bar>
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Actual">
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="hsl(var(--primary))" />
                    ))}
                    <LabelList dataKey="actual" content={renderActualLabel} />
                  </Bar>
              </BarChart>
            </ChartContainer>
            );
            return needsScroll ? (
              <div className="overflow-x-auto">
                {chartElement}
              </div>
            ) : chartElement;
          })()}
        </CardContent>
      </Card>

      {/* Drilldown dialog */}
      <Dialog open={isDrilldownOpen} onOpenChange={(open) => { if (!open) { setSelectedTeam(null); setSelectedMember(null); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{drilldownTitle} — Task Progress</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {activeDrilldown.length}개 태스크 | 평균 Plan {drilldownAvgPlanned}% / Actual {drilldownAvgActual}%
            </p>
          </DialogHeader>
          <div className="space-y-2">
            {activeDrilldown.length === 0 && <p className="text-sm text-muted-foreground">No tasks found.</p>}
            {activeDrilldown.map((t) => (
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
                  <span className={`text-sm font-mono font-bold ${t.gap >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {t.gap >= 0 ? `+${t.gap}` : t.gap}%
                  </span>
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
