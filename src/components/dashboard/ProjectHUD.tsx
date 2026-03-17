import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { mockTasks, mockMilestones, calcPlannedProgress } from "@/lib/mockData";
import { CalendarClock, ListTodo, AlertTriangle, TrendingUp } from "lucide-react";

export function ProjectHUD() {
  const totalTasks = mockTasks.length;
  const avgProgress = Math.round(mockTasks.reduce((s, t) => s + t.current_progress, 0) / totalTasks);
  const avgPlanned = Math.round(mockTasks.reduce((s, t) => s + calcPlannedProgress(t.start_date, t.end_date), 0) / totalTasks);
  const activeIssues = mockTasks.filter(t => t.issue_flag !== "normal").length;
  const completionRate = Math.round(mockTasks.filter(t => t.current_progress >= 90).length / totalTasks * 100);

  // D-Day: days to final milestone
  const finalMs = mockMilestones[mockMilestones.length - 1];
  const dDay = Math.ceil((new Date(finalMs.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const donutData = [
    { name: "Actual", value: avgProgress },
    { name: "Remaining", value: 100 - avgProgress },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Donut */}
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

      {/* D-Day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> D-Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold font-mono text-primary">D-{dDay}</span>
          <p className="text-xs text-muted-foreground mt-1">{finalMs.name}</p>
        </CardContent>
      </Card>

      {/* Total Tasks */}
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

      {/* Active Issues */}
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

      {/* Completion Rate */}
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
