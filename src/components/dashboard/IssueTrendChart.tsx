import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { startOfWeek, subWeeks, format, isAfter, parseISO } from "date-fns";

const chartConfig = {
  critical: { label: "Critical", color: "hsl(var(--destructive))" },
  warning: { label: "Warning", color: "hsl(var(--warning))" },
};

export function IssueTrendChart() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, issue_flag, created_at, updated_at");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const now = new Date();
  const weeks: { label: string; start: Date; end: Date }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    weeks.push({ label: format(ws, "MM/dd"), start: ws, end: we });
  }

  const issueTasks = tasks.filter((t) => t.issue_flag !== "normal");
  const eightWeeksAgo = weeks[0].start;

  const chartData = weeks.map((w) => {
    const inWeek = issueTasks.filter((t) => {
      const d = parseISO(t.updated_at);
      return isAfter(d, eightWeeksAgo) && d >= w.start && d <= w.end;
    });
    return {
      week: w.label,
      critical: inWeek.filter((t) => t.issue_flag === "critical").length,
      warning: inWeek.filter((t) => t.issue_flag === "warning").length,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Issue Trend</CardTitle>
        <p className="text-xs text-muted-foreground">Weekly critical & warning issues (8 weeks)</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-xs fill-muted-foreground"
                width={24}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="warning"
                stackId="issues"
                fill="hsl(var(--warning))"
                radius={[0, 0, 0, 0]}
                name="Warning"
              />
              <Bar
                dataKey="critical"
                stackId="issues"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
                name="Critical"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
