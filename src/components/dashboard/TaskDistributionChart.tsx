import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";

const BRACKETS = [
  { label: "0–25%", min: 0, max: 25, color: "hsl(var(--destructive))" },
  { label: "26–50%", min: 26, max: 50, color: "hsl(var(--warning))" },
  { label: "51–75%", min: 51, max: 75, color: "hsl(var(--info))" },
  { label: "76–100%", min: 76, max: 100, color: "hsl(var(--success))" },
];

const chartConfig = Object.fromEntries(
  BRACKETS.map((b) => [b.label, { label: b.label, color: b.color }])
);

export function TaskDistributionChart() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, current_progress");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const distribution = BRACKETS.map((b) => ({
    name: b.label,
    value: tasks.filter((t) => t.current_progress >= b.min && t.current_progress <= b.max).length,
    color: b.color,
  }));

  const total = tasks.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Task Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">Progress bracket breakdown</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="h-[200px] w-[200px] mx-auto shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {distribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-2 flex-1 min-w-0">
              {distribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                  <span className="text-xs font-mono font-semibold">
                    {d.value}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-1.5 mt-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex-1">Total</span>
                  <span className="text-xs font-mono font-semibold">{total}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
