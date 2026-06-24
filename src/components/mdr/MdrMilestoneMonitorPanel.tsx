/**
 * 마일스톤 모니터링 패널.
 *  - 1단: SD / DD / CD (stage colSpan)
 *  - 2단: 마일스톤 plan_date 컬럼 (각 셀당 colSpan=3, STR DD 의 경우 라벨 캡션 부기)
 *  - 3단: P(계획) / A(실적) / Δ(차이)
 *  - 행: Block × Discipline
 *  - [신규 계산] 버튼: 전체 재계산 + snapshot upsert
 *  - 기본 로드: 최신 snapshot 그대로 표시 (없으면 즉시 계산)
 *  - 우측: IFR/IFA, IFC 발행 이정표(읽기 전용, 향후 확장)
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeMatrix,
  loadLatestSnapshot,
  saveSnapshot,
  type MonitorMatrix,
  type MonitorMilestoneKey,
} from "@/lib/mdr/milestoneMonitorEngine";
import type { MdrStage } from "@/lib/mdr/parser";

const STAGES: MdrStage[] = ["SD", "DD", "CD"];

function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtDelta(n: number): string {
  if (!isFinite(n)) return "—";
  const v = n.toFixed(1);
  return n > 0 ? `+${v}%` : `${v}%`;
}
function deltaClass(n: number): string {
  if (!isFinite(n) || Math.abs(n) < 0.05) return "text-muted-foreground";
  return n < 0 ? "text-destructive" : "text-primary";
}

function mkKey(stage: MdrStage, pct: number, planDate: string | null): string {
  return `${stage}|${pct}|${planDate ?? ""}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const yy = m[1].slice(2);
  const mon = MONTHS[parseInt(m[2], 10) - 1] ?? m[2];
  return `${m[3]}-${mon}-${yy}`;
}

// 스테이지별 헤더 색상 (시인성)
const STAGE_THEME: Record<MdrStage, { head: string; sub: string; border: string; text: string }> = {
  SD: { head: "bg-sky-500/25 text-sky-100",     sub: "bg-sky-500/10",     border: "border-sky-500/40",     text: "text-sky-200" },
  DD: { head: "bg-amber-500/25 text-amber-100", sub: "bg-amber-500/10",   border: "border-amber-500/40",   text: "text-amber-200" },
  CD: { head: "bg-emerald-500/25 text-emerald-100", sub: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-200" },
};

export function MdrMilestoneMonitorPanel() {
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [matrix, setMatrix] = useState<MonitorMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  // 초기 로드 — 최신 snapshot 표시
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await loadLatestSnapshot();
        if (cancelled) return;
        if (snap) {
          setMatrix(snap);
          setAsOf(snap.asOf);
        } else {
          // snapshot 없음 → 즉시 계산
          const today = new Date().toISOString().slice(0, 10);
          const m = await computeMatrix(today);
          if (cancelled) return;
          setMatrix(m);
          setAsOf(today);
        }
      } catch (e: any) {
        toast.error(`마일스톤 모니터링 로드 실패: ${e?.message ?? e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const m = await computeMatrix(asOf);
      setMatrix(m);
      await saveSnapshot(m);
      toast.success(`신규 계산 완료 — 기준일 ${asOf}`);
    } catch (e: any) {
      toast.error(`재계산 실패: ${e?.message ?? e}`);
    } finally {
      setRecomputing(false);
    }
  };

  // 컬럼 헤더 메모
  const headers = useMemo(() => {
    if (!matrix) return null;
    const stageMs: { stage: MdrStage; ms: MonitorMilestoneKey[] }[] = STAGES.map((s) => ({
      stage: s, ms: matrix.milestonesByStage[s] ?? [],
    }));
    return stageMs;
  }, [matrix]);

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 마일스톤 모니터링 로드 중…
      </Card>
    );
  }
  if (!matrix || matrix.rows.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        모니터링할 도면이 없습니다. MDR 임포트 후 [신규 계산]을 눌러주세요.
        <div className="mt-3">
          <Button onClick={handleRecompute} disabled={recomputing} size="sm">
            <RefreshCw className={`h-3 w-3 mr-1 ${recomputing ? "animate-spin" : ""}`} /> 신규 계산
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">마일스톤 모니터링 — Block × Discipline × Milestone</h3>
          <div className="text-[10px] text-muted-foreground">
            P=계획·A=실적·Δ=차이 · 단계 순차 강제(SD→DD→CD) 적용 · 기준일 일할 계산
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">기준일</label>
          <Input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Button onClick={handleRecompute} disabled={recomputing} size="sm" variant="default">
            {recomputing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            신규 계산
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            {/* 1단: Stage */}
            <tr className="border-b bg-muted/30">
              <th rowSpan={3} className="text-left px-2 py-1 sticky left-0 bg-background border-r">Block</th>
              <th rowSpan={3} className="text-left px-2 py-1 border-r">Disc.</th>
              <th rowSpan={3} className="text-center px-2 py-1 border-r">DWG</th>
              {headers?.map(({ stage, ms }) => (
                <th
                  key={`s-${stage}`}
                  colSpan={Math.max(1, ms.length) * 3}
                  className="text-center px-2 py-1 border-l font-semibold"
                >
                  {stage}
                </th>
              ))}
            </tr>
            {/* 2단: 마일스톤 plan_date (+ 라벨 캡션) */}
            <tr className="border-b">
              {headers?.flatMap(({ stage, ms }) =>
                ms.length === 0 ? (
                  <th key={`empty-${stage}`} colSpan={3} className="text-center px-2 py-0.5 border-l text-muted-foreground text-[10px]">
                    —
                  </th>
                ) : ms.map((m) => (
                  <th key={`ms-${stage}-${m.pct}-${m.planDate}`} colSpan={3} className="text-center px-1 py-0.5 border-l text-[10px]">
                    <div className="flex flex-col items-center leading-tight">
                      {m.label && (
                        <span className="text-[9px] text-muted-foreground italic">{m.label}</span>
                      )}
                      <span className="tabular-nums">{m.planDate ?? "—"}</span>
                      <span className="text-[9px] text-muted-foreground">{stage}{m.pct}%</span>
                    </div>
                  </th>
                ))
              )}
            </tr>
            {/* 3단: P / A / Δ */}
            <tr className="border-b-2 text-muted-foreground">
              {headers?.flatMap(({ stage, ms }) => {
                const list = ms.length === 0 ? [{ pct: 0, planDate: null as string | null }] : ms;
                return list.flatMap((m) => [
                  <th key={`p-${stage}-${m.pct}-${m.planDate}`} className="text-center px-1 py-0.5 border-l font-normal">P</th>,
                  <th key={`a-${stage}-${m.pct}-${m.planDate}`} className="text-center px-1 py-0.5 font-normal">A</th>,
                  <th key={`d-${stage}-${m.pct}-${m.planDate}`} className="text-center px-1 py-0.5 font-normal">Δ</th>,
                ]);
              })}
            </tr>

          </thead>
          <tbody>
            {matrix.rows.map((row, ri) => {
              const prev = ri > 0 ? matrix.rows[ri - 1] : null;
              const showBlock = !prev || prev.building !== row.building;
              const blockRowSpan = matrix.rows.filter((r) => r.building === row.building).length;
              return (
                <tr key={`${row.building}-${row.discipline}`} className="border-b hover:bg-muted/20">
                  {showBlock && (
                    <td rowSpan={blockRowSpan} className="px-2 py-0.5 sticky left-0 bg-background font-semibold border-r align-top">
                      {row.building}
                    </td>
                  )}
                  <td className="px-2 py-0.5 border-r">{row.discipline}</td>
                  <td className="text-center px-2 py-0.5 border-r tabular-nums">{row.drawingCount}</td>
                  {headers?.flatMap(({ stage, ms }) => {
                    if (ms.length === 0) {
                      return [<td key={`empty-${stage}-${ri}`} colSpan={3} className="text-center px-1 py-0.5 border-l text-muted-foreground">—</td>];
                    }
                    return ms.flatMap((m) => {
                      const cell = row.cells.get(mkKey(stage, m.pct, m.planDate));
                      if (!cell) {
                        return [
                          <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 border-l text-muted-foreground">—</td>,
                          <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 text-muted-foreground">—</td>,
                          <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 text-muted-foreground">—</td>,
                        ];
                      }
                      return [
                        <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 border-l tabular-nums">{fmtPct(cell.plan)}</td>,
                        <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 tabular-nums">{fmtPct(cell.actual)}</td>,
                        <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} className={`text-center px-1 py-0.5 tabular-nums ${deltaClass(cell.delta)}`}>{fmtDelta(cell.delta)}</td>,
                      ];
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground">
        ※ 발행 이정표(IFR/IFA, IFC)는 별도 영역에서 추후 표시 예정. 도면 단계 흐름:
        SD → DD → CD → IFR/IFA → IFC (선행 미완료 시 후행 진척 무시).
      </div>
    </Card>
  );
}
