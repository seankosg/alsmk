import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKukuDashboard } from "@/hooks/useKukuDashboard";
import { Link2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export function KukuCoverageRate() {
  const { data, isLoading } = useKukuDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" />KUKU Task Coverage</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const acts = data?.kukuActivities || [];
  const mapped = acts.filter((a) => a.mappedTaskIds.length > 0).length;
  const unmapped = acts.length - mapped;
  const pct = acts.length ? Math.round((mapped / acts.length) * 100) : 0;

  const chartData = [
    { name: "Mapped", value: mapped },
    { name: "Unmapped", value: unmapped },
  ];
  const COLORS = ["hsl(var(--primary))", "hsl(var(--muted))"];

  const unmappedList = acts
    .filter((a) => a.mappedTaskIds.length === 0)
    .slice(0, 8);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          KUKU Task Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={28} outerRadius={42} dataKey="value" stroke="none">
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v}`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{pct}%</span>
            </div>
          </div>
          <div className="flex-1 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Mapped</span><span className="font-medium">{mapped}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unmapped</span><span className="font-medium">{unmapped}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{acts.length}</span></div>
          </div>
        </div>

        {unmappedList.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <div className="text-[10px] text-muted-foreground mb-1">Unmapped Activities</div>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {unmappedList.map((a) => (
                <div
                  key={a.id}
                  className="text-[11px] flex gap-2 cursor-pointer hover:text-primary truncate"
                  onClick={() => navigate(`/cpm?wbs=${a.wbs_full}`)}
                >
                  <span className="text-muted-foreground shrink-0">{a.wbs_full}</span>
                  <span className="truncate">{a.name}</span>
                </div>
              ))}
              {unmapped > 8 && <div className="text-[10px] text-muted-foreground">+{unmapped - 8} more</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
