import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { LayoutDashboard, AlertTriangle, ExternalLink } from "lucide-react";

import {
  useMdrSummary,
  useMdrOverdueDrawings,
  selectDisciplineRollup,
  selectStageRollup,
} from "@/lib/mdr/summaryEngine";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function HBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "muted" }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 w-full rounded bg-muted overflow-hidden">
      <div
        className={tone === "primary" ? "h-full bg-primary" : "h-full bg-muted-foreground/60"}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export default function DesignDashboard() {
  const { isAdminOrPm, loading } = useAuth();
  const { data: summary, isLoading } = useMdrSummary();
  const { data: overdue } = useMdrOverdueDrawings(20);


  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  const blocks = (summary?.blocks ?? []).filter((b) => b.contributesToOverall);
  const discRollup = summary ? selectDisciplineRollup(summary) : [];
  const stageRollup = summary ? selectStageRollup(summary) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Design Dashboard
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link to="/design/summary">
            상세 매트릭스 보기 <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      {isLoading && <Card className="p-6 text-muted-foreground">SUMMARY 계산 중...</Card>}

      {!isLoading && summary && (
        <>
          {/* 1. Overall Progress */}
          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold">Overall Progress</h3>
              <span className="text-xs text-muted-foreground">
                도면 {summary.overallDrawingCount} · CD 100% {summary.overallActualCount} · 가중 평균
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded border-2 border-primary/50 bg-primary/5 p-3 col-span-2 md:col-span-1">
                <div className="text-xs text-muted-foreground">Overall</div>
                <div className="text-3xl font-bold text-primary tabular-nums">
                  {pct(summary.overallProgress)}
                </div>
              </div>
              {blocks.map((b) => (
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

          {/* 2-3. 건물별 / 분야별 바차트 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">건물별 현황</h3>
              <div className="space-y-2">
                {blocks.map((b) => (
                  <div key={b.building}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{b.building}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {pct(b.blockProgress)} · WF {pct(b.buildingWf)}
                      </span>
                    </div>
                    <HBar value={b.blockProgress} />
                  </div>
                ))}
                {blocks.length === 0 && (
                  <div className="text-muted-foreground text-sm">데이터 없음</div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">분야별 현황</h3>
              <div className="space-y-2">
                {discRollup.map((d) => (
                  <div key={d.discipline}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{d.discipline}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {pct(d.weightedProgress)} · WF {pct(d.disciplineWf)} · {d.drawingCount}건
                      </span>
                    </div>
                    <HBar value={d.weightedProgress} />
                  </div>
                ))}
                {discRollup.length === 0 && (
                  <div className="text-muted-foreground text-sm">데이터 없음</div>
                )}
              </div>
            </Card>
          </div>

          {/* 4. 계획 대비 실적 (Stage별) */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">계획 대비 실적 (Stage별)</h3>
            <div className="grid grid-cols-3 gap-3">
              {stageRollup.map((s) => (
                <div key={s.stage} className="rounded border p-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-semibold">{s.stage}</span>
                    <span className="text-xl font-bold tabular-nums text-primary">
                      {pct(s.rate)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Plan {s.plan} · Actual {s.actual} · 남음 {Math.max(0, s.plan - s.actual)}
                  </div>
                  <div className="mt-2"><HBar value={s.rate} /></div>
                </div>
              ))}
            </div>
          </Card>

          {/* 5. 주요 문제점 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                지연 도면 Top {overdue?.length ?? 0}
              </h3>
              <span className="text-xs text-muted-foreground">
                plan_date 경과 & 미완료
              </span>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left px-2 py-1">도면</th>
                    <th className="text-left px-2 py-1">Block</th>
                    <th className="text-left px-2 py-1">Disc.</th>
                    <th className="text-center px-2 py-1">Stage</th>
                    <th className="text-center px-2 py-1">Plan Date</th>
                    <th className="text-center px-2 py-1">진척</th>
                    <th className="text-right px-2 py-1">지연일</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue ?? []).map((o, i) => (
                    <tr key={`${o.id}-${o.stage}-${i}`} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1">
                        <div className="font-medium">{o.drawing_no ?? "-"}</div>
                        <div className="text-muted-foreground truncate max-w-[280px]">{o.title}</div>
                      </td>
                      <td className="px-2 py-1">{o.building_code}</td>
                      <td className="px-2 py-1">{o.discipline}</td>
                      <td className="text-center px-2 py-1">{o.stage}</td>
                      <td className="text-center px-2 py-1 tabular-nums">{o.plan_date}</td>
                      <td className="text-center px-2 py-1 tabular-nums">{o.pct.toFixed(0)}%</td>
                      <td className="text-right px-2 py-1 tabular-nums">
                        <Badge variant="destructive">{o.daysLate}d</Badge>
                      </td>
                    </tr>
                  ))}
                  {(!overdue || overdue.length === 0) && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-4">지연 도면 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

