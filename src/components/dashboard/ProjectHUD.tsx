import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ListTodo, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { calcPlannedProgress } from "@/lib/mockData";
import { QueryErrorCard } from "./QueryErrorCard";

const BRACKETS = [
  { label: "0–25%", min: 0, max: 25, color: "hsl(var(--destructive))" },
  { label: "26–50%", min: 26, max: 50, color: "hsl(var(--warning))" },
  { label: "51–75%", min: 51, max: 75, color: "hsl(var(--info))" },
  { label: "76–100%", min: 76, max: 100, color: "hsl(var(--success))" },
];

const distChartConfig = Object.fromEntries(
  BRACKETS.map((b) => [b.label, { label: b.label, color: b.color }])
);

export function ProjectHUD() {
  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (isError) {
    return <QueryErrorCard title="Project Summary" onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
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

  // Task distribution
  const distribution = BRACKETS.map((b) => ({
    name: b.label,
    value: tasks.filter((t) => t.current_progress >= b.min && t.current_progress <= b.max).length,
    color: b.color,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Donut Chart Card */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center pt-6 pb-4">
          <div className="h-36 w-36 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={plannedDonutData} cx="50%" cy="50%" innerRadius={56} outerRadius={66} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="hsl(38, 90%, 50%)" />
                  <Cell fill="hsl(220, 20%, 18%)" />
                </Pie>
                <Pie data={actualDonutData} cx="50%" cy="50%" innerRadius={36} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="hsl(215, 80%, 55%)" />
                  <Cell fill="hsl(220, 20%, 18%)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
              <span className={`text-xl font-bold font-mono ${gap >= 0 ? "text-success" : "text-destructive"}`}>
                {gap > 0 ? "+" : ""}{gap}%p
              </span>
            </div>
          </div>
          <div className="mt-1 flex flex-col items-center gap-0.5 text-[10px]">
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

      {/* Task Distribution Card */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-xs text-muted-foreground">Task Distribution</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="flex items-center gap-3">
            <ChartContainer config={distChartConfig} className="h-[140px] w-[140px] shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={62}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {distribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-1.5 flex-1 min-w-0">
              {distribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-muted-foreground flex-1">{d.name}</span>
                  <span className="text-[10px] font-mono font-semibold">
                    {d.value}
                    <span className="text-muted-foreground font-normal ml-0.5">
                      ({totalTasks > 0 ? Math.round((d.value / totalTasks) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
