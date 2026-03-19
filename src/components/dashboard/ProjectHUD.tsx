import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ListTodo, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress } from "@/lib/mockData";

export function ProjectHUD() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const totalTasks = tasks.length;
  const avgProgress = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks) : 0;
  const avgPlanned = totalTasks > 0 ? Math.round(tasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks) : 0;
  const gap = avgProgress - avgPlanned;

  const completed = tasks.filter(t => t.current_progress >= 100).length;
  const inProgress = tasks.filter(t => t.current_progress > 0 && t.current_progress < 100).length;
  const notStarted = tasks.filter(t => t.current_progress === 0).length;

  const actualDonutData = [
    { name: "Actual", value: avgProgress },
    { name: "Remaining", value: 100 - avgProgress },
  ];
  const plannedDonutData = [
    { name: "Planned", value: avgPlanned },
    { name: "Remaining", value: 100 - avgPlanned },
  ];

  const summaryItems = [
    { label: "Total", value: totalTasks, icon: ListTodo, color: "text-foreground" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "text-success" },
    { label: "In Progress", value: inProgress, icon: Clock, color: "text-primary" },
    { label: "Not Started", value: notStarted, icon: CircleDashed, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Donut Chart Card */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center pt-6">
          <div className="h-28 w-28 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={plannedDonutData} cx="50%" cy="50%" innerRadius={44} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="hsl(38, 90%, 50%)" />
                  <Cell fill="hsl(220, 20%, 18%)" />
                </Pie>
                <Pie data={actualDonutData} cx="50%" cy="50%" innerRadius={28} outerRadius={40} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="hsl(215, 80%, 55%)" />
                  <Cell fill="hsl(220, 20%, 18%)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
              <span className={`text-lg font-bold font-mono ${gap >= 0 ? "text-success" : "text-destructive"}`}>
                {gap > 0 ? "+" : ""}{gap}%p
              </span>
            </div>
          </div>
          <div className="mt-2 flex flex-col items-center gap-0.5 text-[10px]">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(215, 80%, 55%)" }} />Actual {avgProgress}%</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(38, 90%, 50%)" }} />Plan {avgPlanned}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                <div>
                  <span className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</span>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
