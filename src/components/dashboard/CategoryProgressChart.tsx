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

const chartConfig = {
  planned: { label: "Planned", color: "hsl(var(--muted-foreground))" },
  actual: { label: "Actual", color: "hsl(var(--primary))" },
};

export function CategoryProgressChart() {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: tasks = [], isLoading } = useQuery({
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
      const { data, error } = await supabase.from("teams").select("*").order("name");
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

  // Exclude summary tasks without a category
  const filteredTasks = tasks.filter(t => !(t.is_summary && !t.category));

  // Group tasks by category
  const categories = Array.from(new Set(filteredTasks.map(t => t.category || "Uncategorized")));

  const chartData = categories.map((cat) => {
    const catTasks = filteredTasks.filter(t => (t.category || "Uncategorized") === cat);
    const avgActual = catTasks.length > 0
      ? Math.round(catTasks.reduce((s, t) => s + t.current_progress, 0) / catTasks.length)
      : 0;
    const avgPlanned = catTasks.length > 0
      ? Math.round(catTasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / catTasks.length)
      : 0;
    const gap = avgActual - avgPlanned;
    return { name: cat, planned: avgPlanned, actual: avgActual, gap };
  });

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      setSelectedCategory(data.activePayload[0].payload.name);
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

  const behindTasks = selectedCategory
    ? filteredTasks
        .filter(t => (t.category || "Uncategorized") === selectedCategory)
        .map(t => {
          const planned = calcPlannedProgress(t.start_date, t.end_date);
          return { ...t, planned, gap: t.current_progress - planned };
        })
        .filter(t => t.gap < 0)
        .sort((a, b) => a.gap - b.gap)
    : [];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Category Progress</CardTitle>
          <p className="text-xs text-muted-foreground">Planned vs Actual by category — click a bar to drill down</p>
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
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.actual >= entry.planned ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    />
                  ))}
                  <LabelList dataKey="actual" content={renderActualLabel} />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCategory && !selectedTask} onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedCategory} — Behind Schedule
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{behindTasks.length} task(s) behind schedule</p>
          </DialogHeader>
          <div className="space-y-2">
            {behindTasks.length === 0 && <p className="text-sm text-muted-foreground">All tasks are on or ahead of schedule.</p>}
            {behindTasks.map((t) => (
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
        readOnly={!isAdmin && selectedTask?.assignee_id !== memberId}
      />
    </>
  );
}
