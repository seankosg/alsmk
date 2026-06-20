import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMdrSummary } from "@/lib/mdr/summaryEngine";
import type { BlockSummary, StageCell } from "@/lib/mdr/summaryEngine";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings2, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function StageCells({ cell }: { cell: StageCell }) {
  return (
    <>
      <td className="text-center px-2 py-0.5 border-l tabular-nums">{cell.plan || "-"}</td>
      <td className="text-center px-2 py-0.5 tabular-nums">{cell.actual || "-"}</td>
      <td className="text-center px-2 py-0.5 tabular-nums text-primary">
        {cell.plan > 0 ? pct(cell.progress) : "-"}
      </td>
    </>
  );
}

function BlockRow({ block }: { block: BlockSummary }) {
  const dim = !block.contributesToOverall;
  return (
    <>
      {block.cells.map((c, idx) => (
        <tr
          key={`${block.building}-${c.discipline}`}
          className={`border-b hover:bg-muted/30 ${dim ? "opacity-50" : ""}`}
        >
          {idx === 0 && (
            <td
              rowSpan={block.cells.length + 1}
              className="px-2 py-0.5 sticky left-0 bg-background font-semibold align-top border-r"
            >
              <div className="flex flex-col gap-0.5">
                <span>{block.building}</span>
                {dim ? (
                  <Badge variant="outline" className="text-[10px] w-fit">합산 제외</Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">WF {pct(block.buildingWf)}</span>
                )}
              </div>
            </td>
          )}
          <td className="px-2 py-0.5">{c.discipline}</td>
          <td className="text-center px-2 py-0.5 tabular-nums">{c.drawingCount}</td>
          <StageCells cell={c.sd} />
          <StageCells cell={c.dd} />
          <StageCells cell={c.cd} />
          <td className="text-center px-2 py-0.5 border-l font-medium tabular-nums">{pct(c.discProgress)}</td>
        </tr>
      ))}
      <tr className={`border-b-2 bg-muted/40 ${dim ? "opacity-50" : ""}`}>
        <td className="px-2 py-0.5 text-[11px] font-semibold">Sub-total</td>
        <td className="text-center px-2 py-0.5 tabular-nums">{block.drawingCount}</td>
        <StageCells cell={block.totals.sd} />
        <StageCells cell={block.totals.dd} />
        <StageCells cell={block.totals.cd} />
        <td className="text-center px-2 py-0.5 border-l font-bold tabular-nums text-primary">{pct(block.blockProgress)}</td>
      </tr>
    </>
  );
}

export function MdrSummaryPanel() {
  const { data: summary, isLoading } = useMdrSummary();

  if (isLoading) return <div className="text-muted-foreground p-6">SUMMARY 계산 중...</div>;
  if (!summary || summary.blocks.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Raw Data가 없습니다. 먼저 MDR 엑셀을 임포트하세요.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Block × Discipline × Stage 매트릭스 */}
      <Card className="p-3">
        <h3 className="font-semibold mb-2 text-sm">Block × Discipline × Stage 매트릭스</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b">
                <th rowSpan={2} className="text-left px-2 py-0.5 sticky left-0 bg-background border-r">Block</th>
                <th rowSpan={2} className="text-left px-2 py-0.5">Disc.</th>
                <th rowSpan={2} className="text-center px-2 py-0.5">DWG</th>
                <th colSpan={3} className="text-center px-2 py-0.5 border-l">SD</th>
                <th colSpan={3} className="text-center px-2 py-0.5 border-l">DD</th>
                <th colSpan={3} className="text-center px-2 py-0.5 border-l">CD</th>
                <th rowSpan={2} className="text-center px-2 py-0.5 border-l">Disc. Progress</th>
              </tr>
              <tr className="border-b text-muted-foreground">
                {["SD", "DD", "CD"].flatMap((s) => [
                  <th key={`${s}-p`} className="text-center px-2 py-0.5 border-l font-normal">Plan</th>,
                  <th key={`${s}-a`} className="text-center px-2 py-0.5 font-normal">Actual</th>,
                  <th key={`${s}-pct`} className="text-center px-2 py-0.5 font-normal">%</th>,
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



      {/* WF 참조 — 컴팩트 (접이식) */}
      <Collapsible>
        <Card className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
              <span>Weight Factor 참조</span>
              <span className="hidden sm:inline tabular-nums">
                · Stage SD/DD/CD {pct(summary.wf.stage.SD)}/{pct(summary.wf.stage.DD)}/{pct(summary.wf.stage.CD)}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link to="/admin"><Settings2 className="h-3 w-3 mr-1" />수정</Link>
            </Button>
          </div>
          <CollapsibleContent>
            <div className="grid gap-3 md:grid-cols-3 mt-3 text-xs">
              <div>
                <div className="font-medium text-muted-foreground mb-1">Stage WF</div>
                {(["SD", "DD", "CD"] as const).map((s) => (
                  <div key={s} className="flex justify-between border-b py-0.5">
                    <span>{s}</span>
                    <span className="tabular-nums">{pct(summary.wf.stage[s])}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-medium text-muted-foreground mb-1">Discipline WF</div>
                {Object.entries(summary.wf.discipline).map(([d, w]) => (
                  <div key={d} className="flex justify-between border-b py-0.5">
                    <span>{d}</span>
                    <span className="tabular-nums">{pct(w)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-medium text-muted-foreground mb-1">Building WF</div>
                {Object.entries(summary.wf.building).map(([b, w]) => (
                  <div key={b} className="flex justify-between border-b py-0.5">
                    <span>{b}</span>
                    <span className="tabular-nums">{pct(w)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
