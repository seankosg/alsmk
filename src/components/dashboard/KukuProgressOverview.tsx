import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { Activity, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function KukuProgressOverview() {
  const { data, isLoading } = useKukuDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />KUKU Activity Overview</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const acts = data?.kukuActivities || [];
  const total = acts.length;
  const completed = acts.filter((a) => (a.progress ?? 0) >= 100).length;
  const notStarted = acts.filter((a) => (a.progress ?? 0) === 0).length;
  const inProgress = total - completed - notStarted;
  const critical = acts.filter((a) => a.is_critical).length;

  // Duration-weighted actual progress
  let totalDur = 0, wActual = 0, wPlanned = 0;
  acts.forEach((a) => {
    const dur = Math.max(1, a.duration);
    totalDur += dur;
    wActual += (a.progress ?? 0) * dur;
    wPlanned += a.plannedProgress * dur;
  });
  const avgActual = totalDur ? Math.round(wActual / totalDur) : 0;
  const avgPlanned = totalDur ? Math.round(wPlanned / totalDur) : 0;
  const gap = avgActual - avgPlanned;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          KUKU Activity Overview
          <Badge variant="outline" className="ml-auto text-xs">{total} Activities</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 min-h-0">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-green-600">{completed}</div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><CheckCircle2 className="h-3 w-3" />Complete</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{inProgress}</div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><Clock className="h-3 w-3" />In Progress</div>
          </div>
          <div>
            <div className="text-lg font-bold text-muted-foreground">{notStarted}</div>
            <div className="text-[10px] text-muted-foreground">Not Started</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{critical}</div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><AlertTriangle className="h-3 w-3" />Critical</div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Actual (MPP)</span>
            <span className="font-medium">{avgActual}%</span>
          </div>
          <Progress value={avgActual} className="h-2.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Planned (Elapsed)</span>
            <span className="font-medium">{avgPlanned}%</span>
          </div>
          <Progress value={avgPlanned} className="h-2.5 [&>div]:bg-muted-foreground/40" />
          <div className="text-right text-xs">
            <span className={gap >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              Gap: {gap >= 0 ? "+" : ""}{gap}%p
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
