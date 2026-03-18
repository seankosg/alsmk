import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ListTodo, TrendingDown, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";

const MyDashboard = () => {
  const { memberId } = useAuthContext();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: tasks = [], isLoading } = useQuery({
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

  const myTasks = tasks.filter((t) => t.assignee_id === memberId);
  const now = new Date();

  // KPI calculations
  const totalTasks = myTasks.length;
  const completedTasks = myTasks.filter((t) => t.actual_finish).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tasksWithGap = myTasks.map((t) => {
    const planned = calcPlannedProgress(t.start_date, t.end_date);
    const gap = t.current_progress - planned;
    return { ...t, planned, gap };
  });

  const behindTasks = tasksWithGap.filter((t) => t.gap < 0).sort((a, b) => a.gap - b.gap);
  const avgGap = totalTasks > 0 ? Math.round(tasksWithGap.reduce((s, t) => s + t.gap, 0) / totalTasks) : 0;

  // Upcoming deadlines (7 days)
  const upcoming = tasksWithGap
    .filter((t) => {
      const days = differenceInDays(parseISO(t.end_date), now);
      return days >= 0 && days <= 7 && t.current_progress < 100;
    })
    .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <CheckCircle2 className="h-3.5 w-3.5" /> Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-success">{completionRate}%</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Behind Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold font-mono text-warning">{behindTasks.length}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> Avg Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-3xl font-bold font-mono ${avgGap < 0 ? "text-destructive" : "text-success"}`}>
              {avgGap > 0 ? "+" : ""}{avgGap}%
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Behind Schedule List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-base">Behind Schedule</CardTitle>
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
                  const daysLeft = differenceInDays(parseISO(task.end_date), now);
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
      </div>

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
