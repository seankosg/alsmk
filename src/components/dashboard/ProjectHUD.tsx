import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ListTodo, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress } from "@/lib/mockData";

export function ProjectHUD() {
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: milestones = [], isLoading: loadingMs } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (loadingTasks || loadingMs) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const totalTasks = tasks.length;
  const avgProgress = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgPlanned = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks) : 0;
  const activeIssues = tasks.filter(t => t.issue_flag !== "normal").length;
  const completionRate = totalTasks > 0 ? Math.round(tasks.filter(t => t.current_progress >= 90).length / totalTasks * 100) : 0;

  const finalMs = milestones[milestones.length - 1];
  const dDay = finalMs ? Math.ceil((new Date(finalMs.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  const donutData = [
    { name: "Actual", value: avgProgress },
    { name: "Remaining", value: 100 - avgProgress },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="md:col-span-2 lg:col-span-1">
        <CardContent className="flex flex-col items-center justify-center pt-6">
          <div className="h-28 w-28 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="hsl(215, 80%, 55%)" />
                  <Cell fill="hsl(220, 20%, 18%)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono">{avgProgress}%</span>
              <span className="text-[10px] text-muted-foreground">Actual</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Planned: {avgPlanned}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> D-Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold font-mono text-primary">D-{dDay}</span>
          <p className="text-xs text-muted-foreground mt-1">{finalMs?.name ?? "—"}</p>
        </CardContent>
      </Card>

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
            <AlertTriangle className="h-3.5 w-3.5" /> Active Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold font-mono text-warning">{activeIssues}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Completion Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold font-mono text-success">{completionRate}%</span>
          <p className="text-xs text-muted-foreground mt-1">≥90% progress</p>
        </CardContent>
      </Card>
    </div>
  );
}
