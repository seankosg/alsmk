import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { Eye, Loader2, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

export function KukuPredecessorWatch() {
  const { data, isLoading } = useKukuDashboard();
  const navigate = useNavigate();

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          KUKU Predecessor Watch
          <Badge variant="outline" className="ml-auto text-xs">
            {delayed.length} Delayed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {delayed.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No delayed predecessors</div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1.5">
              {delayed.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-red-50 dark:bg-red-950/30 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all"
                  onClick={() => navigate(`/cpm?highlight=${encodeURIComponent(p.mpp_task_id || p.id)}`)}
                >
                  <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
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
                    <div className="font-medium text-red-600">
                      {p.gap >= 0 ? "+" : ""}{p.gap}%p
                    </div>
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
