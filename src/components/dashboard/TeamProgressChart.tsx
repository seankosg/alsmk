import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { calcPlannedProgress } from "@/lib/mockData";

const chartConfig = {
  planned: { label: "Planned", color: "hsl(var(--muted-foreground))" },
  actual: { label: "Actual", color: "hsl(var(--primary))" },
};

export function TeamProgressChart() {
  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: tasks = [], isLoading: ltt } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const isLoading = lt || ltt;

  const chartData = teams.map((team) => {
    const teamTasks = tasks.filter((t) => t.team_id === team.id);
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
    return { name: team.code, planned: avgPlanned, actual: avgActual };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Team Progress</CardTitle>
        <p className="text-xs text-muted-foreground">Planned vs Actual by team</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={chartData} barGap={2} barCategoryGap="20%">
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
              />
              <Bar
                dataKey="actual"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Actual"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
