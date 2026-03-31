import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { Eye, Loader2, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function KukuPredecessorWatch() {
  const { data, isLoading } = useKukuDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Predecessor Watch</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const preds = data?.predecessors || [];
  const delayed = preds.filter((p) => p.gap < -5);
  const onTrack = preds.filter((p) => p.gap >= -5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          KUKU Predecessor Watch
          <Badge variant="outline" className="ml-auto text-xs">
            {delayed.length} Delayed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {preds.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No predecessor data available</div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1.5">
              {preds.map((p, i) => {
                const isDelayed = p.gap < -5;
                return (
                  <div
                    key={`${p.id}-${i}`}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${isDelayed ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"}`}
                  >
                    {isDelayed && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground shrink-0">{p.wbs_full}</span>
                        {p.is_critical && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">CP</Badge>}
                        {p.text1 && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{p.text1}</Badge>}
                      </div>
                      <div className="truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">→ {p.kukuSuccessorName}</div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-[10px] text-muted-foreground">Actual {p.progress ?? 0}%</div>
                      <div className="text-[10px] text-muted-foreground">Plan {p.plannedProgress}%</div>
                      <div className={`font-medium ${isDelayed ? "text-red-600" : "text-green-600"}`}>
                        {p.gap >= 0 ? "+" : ""}{p.gap}%p
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
