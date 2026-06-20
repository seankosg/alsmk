import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMdrSummary } from "@/lib/mdr/summaryEngine";
import type { BlockSummary, StageCell } from "@/lib/mdr/summaryEngine";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function StageCells({ cell }: { cell: StageCell }) {
  return (
    <>
      <td className="text-center px-2 py-1 border-l tabular-nums">{cell.plan || "-"}</td>
      <td className="text-center px-2 py-1 tabular-nums">{cell.actual || "-"}</td>
      <td className="text-center px-2 py-1 tabular-nums text-primary">{cell.plan > 0 ? pct(cell.progress) : "-"}</td>
    </>
  );
}

function BlockRow({ block }: { block: BlockSummary }) {
  const dim = !block.contributesToOverall;
  return (
    <>
      {block.cells.map((c, idx) => (
        <tr key={`${block.building}-${c.discipline}`} className={`border-b hover:bg-muted/30 ${dim ? "opacity-50" : ""}`}>
          {idx === 0 && (
            <td rowSpan={block.cells.length + 1} className="px-2 py-1 sticky left-0 bg-background font-semibold align-top border-r">
              <div className="flex flex-col gap-1">
                <span>{block.building}</span>
                {dim && <Badge variant="outline" className="text-[10px] w-fit">합산 제외</Badge>}
                {!dim && (
                  <span className="text-[10px] text-muted-foreground">WF {pct(block.buildingWf)}</span>
                )}
              </div>
            </td>
          )}
          <td className="px-2 py-1">{c.discipline}</td>
          <td className="text-center px-2 py-1 tabular-nums">{c.drawingCount}</td>
          <StageCells cell={c.sd} />
          <StageCells cell={c.dd} />
          <StageCells cell={c.cd} />
          <td className="text-center px-2 py-1 border-l font-medium tabular-nums">{pct(c.discProgress)}</td>
        </tr>
      ))}
      <tr className={`border-b-2 bg-muted/40 ${dim ? "opacity-50" : ""}`}>
        <td className="px-2 py-1 text-xs font-semibold">Sub-total</td>
        <td className="text-center px-2 py-1 tabular-nums">{block.drawingCount}</td>
        <StageCells cell={block.totals.sd} />
        <StageCells cell={block.totals.dd} />
        <StageCells cell={block.totals.cd} />
        <td className="text-center px-2 py-1 border-l font-bold tabular-nums text-primary">{pct(block.blockProgress)}</td>
      </tr>
    </>
  );
}

export function MdrSummaryPanel() {
  const { data: summary, isLoading } = useMdrSummary();
  const { data: logs } = useQuery({
    queryKey: ["mdr_import_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_import_logs" as never)
        .select("*").order("imported_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  if (isLoading) return <div className="text-muted-foreground p-6">SUMMARY 계산 중...</div>;
  if (!summary || summary.blocks.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Raw Data가 없습니다. 먼저 MDR 엑셀을 임포트하세요.
      </Card>
    );
  }

  const contributingBlocks = summary.blocks.filter((b) => b.contributesToOverall);

  return (
    <div className="space-y-4">
      {/* KPI */}
      <Card className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-semibold">Overall Progress</h3>
          <span className="text-xs text-muted-foreground">
            도면 {summary.overallDrawingCount} · 완료(CD 100%) {summary.overallActualCount} · 가중 평균
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded border-2 border-primary/50 bg-primary/5 p-3 col-span-2 md:col-span-1">
            <div className="text-xs text-muted-foreground">Overall</div>
            <div className="text-3xl font-bold text-primary tabular-nums">{pct(summary.overallProgress)}</div>
          </div>
          {contributingBlocks.map((b) => (
            <div key={b.building} className="rounded border p-3">
              <div className="text-xs text-muted-foreground truncate">{b.building}</div>
              <div className="text-xl font-semibold tabular-nums">{pct(b.blockProgress)}</div>
              <div className="text-[10px] text-muted-foreground">
                WF {pct(b.buildingWf)} · 도면 {b.drawingCount}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Block × Discipline × Stage 매트릭스 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Block × Discipline × Stage 매트릭스</h3>
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th rowSpan={2} className="text-left px-2 py-1 sticky left-0 bg-background border-r">Block</th>
                <th rowSpan={2} className="text-left px-2 py-1">Disc.</th>
                <th rowSpan={2} className="text-center px-2 py-1">DWG</th>
                <th colSpan={3} className="text-center px-2 py-1 border-l">SD</th>
                <th colSpan={3} className="text-center px-2 py-1 border-l">DD</th>
                <th colSpan={3} className="text-center px-2 py-1 border-l">CD</th>
                <th rowSpan={2} className="text-center px-2 py-1 border-l">Disc. Progress</th>
              </tr>
              <tr className="border-b text-muted-foreground">
                {["SD", "DD", "CD"].flatMap((s) => [
                  <th key={`${s}-p`} className="text-center px-2 py-1 border-l font-normal">Plan</th>,
                  <th key={`${s}-a`} className="text-center px-2 py-1 font-normal">Actual</th>,
                  <th key={`${s}-pct`} className="text-center px-2 py-1 font-normal">%</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {summary.blocks.map((b) => (
                <BlockRow key={b.building} block={b} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WF 패널 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Weight Factor (WF)</h3>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin"><Settings2 className="h-3.5 w-3.5 mr-1" />Admin에서 수정</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Stage WF</div>
            <div className="space-y-1">
              {(["SD", "DD", "CD"] as const).map((s) => (
                <div key={s} className="flex justify-between text-sm border-b py-1">
                  <span>{s}</span>
                  <span className="tabular-nums">{pct(summary.wf.stage[s])}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Discipline WF</div>
            <div className="space-y-1">
              {Object.entries(summary.wf.discipline).map(([d, w]) => (
                <div key={d} className="flex justify-between text-sm border-b py-1">
                  <span>{d}</span>
                  <span className="tabular-nums">{pct(w)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Building WF (공사비)</div>
            <div className="space-y-1">
              {Object.entries(summary.wf.building).map(([b, w]) => (
                <div key={b} className="flex justify-between text-sm border-b py-1">
                  <span>{b}</span>
                  <span className="tabular-nums">{pct(w)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 임포트 로그 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">최근 임포트 로그</h3>
        <div className="space-y-1 max-h-48 overflow-auto">
          {(logs ?? []).map((l: any) => (
            <div key={l.id} className="text-sm border-b py-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                <span className="truncate">{l.filename}</span>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                +{l.rows_inserted} · {new Date(l.imported_at).toLocaleString()}
              </span>
            </div>
          ))}
          {(logs ?? []).length === 0 && <div className="text-muted-foreground text-sm">없음</div>}
        </div>
      </Card>
    </div>
  );
}
