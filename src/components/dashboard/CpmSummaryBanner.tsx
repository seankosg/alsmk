import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, Building2, Target, Link2, TrendingDown, ShieldAlert, Activity } from "lucide-react";

interface KpiBoxProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}

const KpiBox = ({ icon, value, label }: KpiBoxProps) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-md bg-muted/40">
    <div className="text-muted-foreground">{icon}</div>
    <div className="text-2xl font-bold text-foreground">{value}</div>
    <div className="text-xs text-muted-foreground font-medium">{label}</div>
  </div>
);

export function CpmSummaryBanner() {
  const { data, isLoading } = useKukuDashboard();

  const { data: thresholds } = useQuery({
    queryKey: ["project_settings", "kuku_thresholds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_settings")
        .select("key, value")
        .in("key", ["kuku_delay_threshold", "kuku_pred_threshold"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => (map[r.key] = r.value));
      return {
        delay: Number(map.kuku_delay_threshold) || 5,
        pred: Number(map.kuku_pred_threshold) || 5,
      };
    },
    staleTime: 60_000,
  });

  const delayThreshold = thresholds?.delay ?? 5;
  const predThreshold = thresholds?.pred ?? 5;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[96px] rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.allActivitiesCount === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          CPM 데이터 없음
        </CardContent>
      </Card>
    );
  }

  const mappedCount = data.kukuActivities.filter(a => a.mappedTaskIds.length > 0).length;
  const kukuTotal = data.kukuActivities.length;
  const mappedRatio = kukuTotal > 0 ? Math.round((mappedCount / kukuTotal) * 100) : 0;

  // Composite KPI calculations
  const delayedCount = data.kukuActivities.filter(a => {
    const actual = a.progress ?? 0;
    return actual < a.plannedProgress - 5;
  }).length;

  const predAlertCount = data.predecessors.filter(p => p.gap < -5).length;

  let overallGap = 0;
  if (kukuTotal > 0) {
    let totalDur = 0, wActual = 0, wPlanned = 0;
    data.kukuActivities.forEach(a => {
      const dur = Math.max(1, a.duration);
      totalDur += dur;
      wActual += (a.progress ?? 0) * dur;
      wPlanned += a.plannedProgress * dur;
    });
    overallGap = totalDur ? Math.round((wActual - wPlanned) / totalDur) : 0;
  }

  const sourceLabel = data.dataSource === "runtime" ? "Runtime" : "DB";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">CPM Summary</span>
          <span className="text-xs text-muted-foreground/50">· {sourceLabel}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiBox
            icon={<BarChart3 className="h-5 w-5" />}
            value={data.allActivitiesCount.toLocaleString()}
            label="Total Activities"
          />
          <KpiBox
            icon={<AlertTriangle className="h-5 w-5" />}
            value={
              <span className={data.criticalCount > 0 ? "text-destructive" : ""}>
                {data.criticalCount}
              </span>
            }
            label="Critical Path"
          />
          <KpiBox
            icon={<Building2 className="h-5 w-5" />}
            value={kukuTotal}
            label="KUKU Activities"
          />
          <KpiBox
            icon={<Target className="h-5 w-5" />}
            value={data.milestoneCount}
            label="Milestones"
          />
          <KpiBox
            icon={<Link2 className="h-5 w-5" />}
            value={
              <span className={mappedRatio < 50 ? "text-yellow-600" : ""}>
                {mappedCount}/{kukuTotal}
              </span>
            }
            label="Mapped"
          />
          {/* Composite KPI card */}
          <div className="flex flex-col justify-center gap-1.5 p-3 rounded-md bg-muted/40">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" /> Delayed
              </span>
              <span className={`font-bold ${delayedCount > 0 ? "text-destructive" : "text-foreground"}`}>
                {delayedCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" /> Pred Alerts
              </span>
              <span className={`font-bold ${predAlertCount > 0 ? "text-orange-500" : "text-foreground"}`}>
                {predAlertCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> Gap
              </span>
              <span className={`font-bold ${overallGap < 0 ? "text-destructive" : overallGap > 0 ? "text-green-600" : "text-foreground"}`}>
                {overallGap > 0 ? "+" : ""}{overallGap}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
