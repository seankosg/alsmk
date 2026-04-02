import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

interface DelayItem {
  id: string;
  name: string;
  wbs_full: string | null;
  actual: number;
  planned: number;
  gap: number;
  is_critical: boolean;
  hasTasks: boolean;
}

export function KukuDelayRiskBoard() {
  const { data, isLoading } = useKukuDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />KUKU Delay Risk</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const acts = data?.kukuActivities || [];

  const delayItems: DelayItem[] = acts
    .map((a) => {
      const hasTasks = a.mappedTaskIds.length > 0;
      const actual = hasTasks ? (a.taskActualPct ?? 0) : (a.progress ?? 0);
      const planned = hasTasks ? (a.taskPlannedPct ?? a.plannedProgress) : a.plannedProgress;
      const gap = actual - planned;
      return { id: a.id, name: a.name, wbs_full: a.wbs_full, actual, planned, gap, is_critical: a.is_critical, hasTasks };
    })
    .filter((item) => item.gap < -5 && item.actual < 100)
    .sort((a, b) => a.gap - b.gap);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          KUKU Delay Risk
          <Badge variant="destructive" className="ml-auto text-xs">{delayItems.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {delayItems.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No delayed KUKU activities 🎉</div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1.5">
              {delayItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-red-50 dark:bg-red-950/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground shrink-0">{item.wbs_full}</span>
                      {item.is_critical && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">CP</Badge>}
                      {item.hasTasks && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">Tasks</Badge>}
                    </div>
                    <div className="truncate">{item.name}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground">A:{item.actual}% / P:{item.planned}%</div>
                    <div className="font-medium text-red-600">{item.gap}%p</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
