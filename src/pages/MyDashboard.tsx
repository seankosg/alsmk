import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  ListTodo, PlayCircle, Activity, TrendingUp, CheckCircle2,
  AlertTriangle, Clock, BarChart3, Target, ArrowDownRight,
} from "lucide-react";
import { differenceInDays, isWithinInterval, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";

const MyDashboard = () => {
  const { memberId } = useAuthContext();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const behindRef = useRef<HTMLDivElement>(null);

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

  const myTasks = tasks.filter((t) => t.assignee_id === memberId);
  const now = startOfDay(new Date());

  const tasksWithGap = myTasks.map((t) => {
    const planned = calcPlannedProgress(t.start_date, t.end_date);
    const gap = t.current_progress - planned;
    return { ...t, planned, gap };
  });

  // Row 1 metrics
  const totalTasks = myTasks.length;
  const plannedInProgress = myTasks.filter((t) => {
    if (t.actual_finish) return false;
    try {
      return isWithinInterval(now, { start: parseLocalDate(t.start_date), end: parseLocalDate(t.end_date) });
    } catch { return false; }
  }).length;
  const actualInProgress = myTasks.filter((t) => t.current_progress > 0 && t.current_progress < 100 && !t.actual_finish).length;
  const aheadTasks = tasksWithGap.filter((t) => t.gap > 0).length;
  const onTrackTasks = tasksWithGap.filter((t) => t.gap === 0).length;
  const behindTasks = tasksWithGap.filter((t) => t.gap < 0).sort((a, b) => a.gap - b.gap);

  // Row 2 metrics
  const avgPlanned = totalTasks > 0 ? Math.round(tasksWithGap.reduce((s, t) => s + t.planned, 0) / totalTasks) : 0;
  const avgActual = totalTasks > 0 ? Math.round(tasksWithGap.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgGap = avgActual - avgPlanned;

  // Upcoming deadlines (7 days)
  const upcoming = tasksWithGap
    .filter((t) => {
      const days = differenceInDays(parseLocalDate(t.end_date), now);
      return days >= 0 && days <= 7 && t.current_progress < 100;
    })
    .sort((a, b) => parseLocalDate(a.end_date).getTime() - parseLocalDate(b.end_date).getTime());

  // Donut data
  const completed = myTasks.filter((t) => t.current_progress >= 100 || t.actual_finish).length;
  const inProgress = myTasks.filter((t) => t.current_progress > 0 && t.current_progress < 100 && !t.actual_finish).length;
  const notStarted = myTasks.filter((t) => t.current_progress === 0 && !t.actual_finish).length;
  const donutData = [
    { name: "Completed", value: completed, color: "hsl(var(--success))" },
    { name: "In Progress", value: inProgress, color: "hsl(var(--primary))" },
    { name: "Not Started", value: notStarted, color: "hsl(var(--muted))" },
  ].filter((d) => d.value > 0);

  const getTeamCode = (teamId: string) => teams.find((t) => t.id === teamId)?.code ?? "";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground">Personal task overview &amp; management</p>
      </div>

      {/* Row 1 — Task Count Cards (6 cols) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Total Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono">{totalTasks}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <PlayCircle className="h-3.5 w-3.5" /> Plan In-Prog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-primary">{plannedInProgress}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Actual In-Prog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-primary">{actualInProgress}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Ahead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-success">{aheadTasks}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> On Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-success">{onTrackTasks}</span>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-1 hover:ring-warning/50 transition-all"
          onClick={() => behindRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Behind
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-warning">{behindTasks.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Progress Averages (3 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Avg Planned %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-muted-foreground">{avgPlanned}%</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Avg Actual %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-primary">{avgActual}%</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5" /> Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-3xl font-bold font-mono ${avgGap < 0 ? "text-destructive" : "text-success"}`}>
              {avgGap > 0 ? "+" : ""}{avgGap}%
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Behind Schedule List */}
      <div ref={behindRef}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-base">Behind Schedule</CardTitle>
              <span className="text-xs text-muted-foreground">({behindTasks.length})</span>
            </div>
            <p className="text-xs text-muted-foreground">Tasks where Actual &lt; Planned</p>
          </CardHeader>
          <CardContent>
            {behindTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All tasks on track 🎉</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                {behindTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="rounded-lg border border-warning/30 bg-warning/5 p-3 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {getTeamCode(task.team_id)} · {task.task_code ?? "—"}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-destructive shrink-0">
                        {task.gap}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={task.current_progress} className="h-1.5 flex-1 [&>div]:bg-warning" />
                      <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
                        {task.current_progress}% / {task.planned}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Due within 7 days</p>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                {upcoming.map((task) => {
                  const daysLeft = differenceInDays(parseLocalDate(task.end_date), now);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="rounded-lg border p-3 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {getTeamCode(task.team_id)} · {task.task_code ?? "—"}
                          </p>
                        </div>
                        <span className={`text-xs font-mono font-semibold shrink-0 ${
                          daysLeft <= 2 ? "text-destructive" : daysLeft <= 5 ? "text-warning" : "text-muted-foreground"
                        }`}>
                          D-{daysLeft}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={task.current_progress} className="h-1.5 flex-1" />
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

        {/* Task Status Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Task Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {totalTasks === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks assigned</p>
            ) : (
              <div className="flex items-center justify-center gap-8">
                <div className="h-40 w-40 relative">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                      >
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold font-mono">{totalTasks}</span>
                    <span className="text-[10px] text-muted-foreground">tasks</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Completed", value: completed, color: "bg-success" },
                    { label: "In Progress", value: inProgress, color: "bg-primary" },
                    { label: "Not Started", value: notStarted, color: "bg-muted" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        teams={teams}
        members={members}
        milestones={milestones}
        readOnly={false}
      />
    </div>
  );
};

export default MyDashboard;
