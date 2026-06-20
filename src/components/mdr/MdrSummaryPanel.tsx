import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

const STAGES = ["SD", "DD", "CD"] as const;

interface MatrixRow {
  snapshot_date: string;
  block_code: string;
  discipline: string;
  sd_plan: number; sd_actual: number;
  dd_plan: number; dd_actual: number;
  cd_plan: number; cd_actual: number;
}

interface WeightRow {
  discipline: string;
  weight: number;
}

export function MdrSummaryPanel() {
  const { data: snapshots } = useQuery({
    queryKey: ["mdr_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_snapshots" as never)
        .select("*").order("snapshot_date", { ascending: false }).limit(50);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["mdr_import_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_import_logs" as never)
        .select("*").order("imported_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: weights } = useQuery({
    queryKey: ["mdr_weights_reference"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_weights" as never)
        .select("discipline, weight")
        .is("building_code", null)
        .is("stage", null)
        .eq("is_reference_only", true);
      if (error) throw error;
      return ((data as any[]) ?? []) as WeightRow[];
    },
  });

  const { data: matrix } = useQuery({
    queryKey: ["mdr_summary_matrix_latest"],
    queryFn: async () => {
      const { data: dateRow } = await supabase
        .from("mdr_summary_matrix" as never)
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const latestDate = (dateRow as any)?.snapshot_date;
      if (!latestDate) return [] as MatrixRow[];
      const { data, error } = await supabase
        .from("mdr_summary_matrix" as never)
        .select("*")
        .eq("snapshot_date", latestDate)
        .order("block_code");
      if (error) throw error;
      return ((data as any[]) ?? []) as MatrixRow[];
    },
  });

  // KPI: Block별 가중 평균 진척률 (단순: Actual/Plan 평균 * 100)
  const kpi = useMemo(() => {
    if (!matrix?.length) return null;
    let totalPlan = 0, totalActual = 0;
    const byBlock = new Map<string, { plan: number; actual: number }>();
    for (const r of matrix) {
      const plan = r.sd_plan + r.dd_plan + r.cd_plan;
      const actual = r.sd_actual + r.dd_actual + r.cd_actual;
      totalPlan += plan; totalActual += actual;
      const b = byBlock.get(r.block_code) ?? { plan: 0, actual: 0 };
      b.plan += plan; b.actual += actual;
      byBlock.set(r.block_code, b);
    }
    return {
      overall: totalPlan ? (totalActual / totalPlan) * 100 : 0,
      totalPlan, totalActual,
      blocks: Array.from(byBlock.entries()).map(([code, v]) => ({
        code, plan: v.plan, actual: v.actual,
        pct: v.plan ? (v.actual / v.plan) * 100 : 0,
      })),
    };
  }, [matrix]);

  // 매트릭스 피벗: row=Block, col=Discipline, value=(Plan/Actual) per stage
  const pivot = useMemo(() => {
    if (!matrix?.length) return null;
    const blocks = Array.from(new Set(matrix.map((r) => r.block_code)));
    const disciplines = Array.from(new Set(matrix.map((r) => r.discipline)));
    const get = (b: string, d: string) => matrix.find((r) => r.block_code === b && r.discipline === d);
    return { blocks, disciplines, get };
  }, [matrix]);

  return (
    <div className="space-y-4">
      {/* KPI */}
      {kpi && (
        <Card className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold">전체 진척률 (SUMMARY 기준)</h3>
            <span className="text-xs text-muted-foreground">
              스냅샷: {matrix?.[0]?.snapshot_date} · Plan {kpi.totalPlan} / Actual {kpi.totalActual}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded border bg-muted/30 p-3 col-span-2 md:col-span-1">
              <div className="text-xs text-muted-foreground">Overall</div>
              <div className="text-2xl font-bold text-primary">{kpi.overall.toFixed(1)}%</div>
            </div>
            {kpi.blocks.map((b) => (
              <div key={b.code} className="rounded border p-3">
                <div className="text-xs text-muted-foreground truncate">{b.code}</div>
                <div className="text-lg font-semibold">{b.pct.toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">{b.actual}/{b.plan}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Block × Discipline × Stage 매트릭스 */}
      {pivot && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Weekly Progress 매트릭스 (Plan / Actual)</h3>
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-2 py-1 sticky left-0 bg-background">Block</th>
                  <th className="text-left px-2 py-1">Disc.</th>
                  {STAGES.map((s) => (
                    <th key={s} className="text-center px-2 py-1 border-l" colSpan={2}>{s}</th>
                  ))}
                </tr>
                <tr className="border-b text-muted-foreground">
                  <th></th><th></th>
                  {STAGES.flatMap((s) => [
                    <th key={`${s}-p`} className="text-center px-2 py-1 border-l">Plan</th>,
                    <th key={`${s}-a`} className="text-center px-2 py-1">Actual</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {pivot.blocks.flatMap((b) =>
                  pivot.disciplines.map((d) => {
                    const r = pivot.get(b, d);
                    if (!r) return null;
                    return (
                      <tr key={`${b}-${d}`} className="border-b hover:bg-muted/30">
                        <td className="px-2 py-1 sticky left-0 bg-background font-medium">{b}</td>
                        <td className="px-2 py-1">{d}</td>
                        <td className="text-center px-2 py-1 border-l">{r.sd_plan || "-"}</td>
                        <td className="text-center px-2 py-1">{r.sd_actual || "-"}</td>
                        <td className="text-center px-2 py-1 border-l">{r.dd_plan || "-"}</td>
                        <td className="text-center px-2 py-1">{r.dd_actual || "-"}</td>
                        <td className="text-center px-2 py-1 border-l">{r.cd_plan || "-"}</td>
                        <td className="text-center px-2 py-1">{r.cd_actual || "-"}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Discipline 가중치 */}
      {weights && weights.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Discipline 가중치 (전사 참고값)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {weights
              .slice()
              .sort((a, b) => b.weight - a.weight)
              .map((w) => (
                <div key={w.discipline} className="rounded border px-2 py-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-medium">{w.discipline}</span>
                  <span className="text-sm tabular-nums">{(w.weight * 100).toFixed(1)}%</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* 스냅샷 & 로그 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">스냅샷 이력</h3>
            <Button variant="outline" size="sm" onClick={() => toast.info("Export는 원본 템플릿 보관 후 활성화됩니다")}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {(snapshots ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b py-1">
                <div className="truncate">
                  <Badge variant="outline" className="mr-2">{s.building_code ?? "-"}</Badge>
                  {s.source_filename}
                </div>
                <span className="text-xs text-muted-foreground">{s.snapshot_date}</span>
              </div>
            ))}
            {(snapshots ?? []).length === 0 && <div className="text-muted-foreground text-sm">없음</div>}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">임포트 로그</h3>
          <div className="space-y-1 max-h-64 overflow-auto">
            {(logs ?? []).map((l: any) => (
              <div key={l.id} className="text-sm border-b py-1">
                <div className="flex items-center gap-2">
                  <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                  <span className="truncate">{l.filename}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  +{l.rows_inserted} / 보존 {l.rows_skipped} · {new Date(l.imported_at).toLocaleString()}
                </div>
              </div>
            ))}
            {(logs ?? []).length === 0 && <div className="text-muted-foreground text-sm">없음</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
