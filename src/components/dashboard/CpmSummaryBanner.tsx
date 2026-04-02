import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, Building2, Target, Link2, Zap } from "lucide-react";

interface KpiBoxProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}

const KpiBox = ({ icon, value, label }: KpiBoxProps) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-md bg-muted/40">
    <div className="text-muted-foreground">{icon}</div>
    <div className="text-xl font-bold text-foreground">{value}</div>
    <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
  </div>
);

export function CpmSummaryBanner() {
  const { data, isLoading } = useKukuDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-md" />
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

  const formatTime = (ts: number | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">CPM Summary</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiBox
            icon={<BarChart3 className="h-4 w-4" />}
            value={data.allActivitiesCount.toLocaleString()}
            label="Total Activities"
          />
          <KpiBox
            icon={<AlertTriangle className="h-4 w-4" />}
            value={
              <span className={data.criticalCount > 0 ? "text-destructive" : ""}>
                {data.criticalCount}
              </span>
            }
            label="Critical Path"
          />
          <KpiBox
            icon={<Building2 className="h-4 w-4" />}
            value={kukuTotal}
            label="KUKU Activities"
          />
          <KpiBox
            icon={<Target className="h-4 w-4" />}
            value={data.milestoneCount}
            label="Milestones"
          />
          <KpiBox
            icon={<Link2 className="h-4 w-4" />}
            value={
              <span className={mappedRatio < 50 ? "text-yellow-600" : ""}>
                {mappedCount}/{kukuTotal}
              </span>
            }
            label="Mapped"
          />
          <KpiBox
            icon={<Zap className="h-4 w-4" />}
            value={
              <Badge variant={data.dataSource === "runtime" ? "default" : "secondary"} className="text-[10px]">
                {data.dataSource === "runtime" ? "Runtime" : "DB"}
              </Badge>
            }
            label={formatTime(data.lastSyncTime) || "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
