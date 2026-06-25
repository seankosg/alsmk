/**
 * 마일스톤 모니터링 패널.
 *  - Total DWG: SD/DD/CD 도면 합
 *  - Overall Progress: 각 단계의 마지막(최대 pct) 마일스톤 P/A/Δ
 *  - SD/DD/CD 마일스톤 컬럼: 단계별 토글 (기본 접힘)
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  computeMatrix,
  loadLatestSnapshot,
  saveSnapshot,
  type MonitorMatrix,
  type MonitorMilestoneKey,
} from "@/lib/mdr/milestoneMonitorEngine";
import type { MdrStage } from "@/lib/mdr/parser";

const WF_STORAGE_KEY = "mdr.monitor.wfEnabled";

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

const STAGE_THEME: Record<MdrStage, { head: string; sub: string; border: string; text: string }> = {
  SD: { head: "bg-sky-300",     sub: "bg-sky-100",     border: "border-sky-500",     text: "text-black" },
  DD: { head: "bg-amber-300",   sub: "bg-amber-100",   border: "border-amber-500",   text: "text-black" },
  CD: { head: "bg-emerald-300", sub: "bg-emerald-100", border: "border-emerald-500", text: "text-black" },
};

export function MdrMilestoneMonitorPanel() {
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [matrix, setMatrix] = useState<MonitorMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [expanded, setExpanded] = useState<Record<MdrStage, boolean>>({ SD: false, DD: false, CD: false });

  const toggleStage = (s: MdrStage) => setExpanded((p) => ({ ...p, [s]: !p[s] }));

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

  const headers = useMemo(() => {
    if (!matrix) return null;
    return STAGES.map((s) => ({ stage: s, ms: matrix.milestonesByStage[s] ?? [] }));
  }, [matrix]);

  // 단계별 "마지막 마일스톤" — Overall Progress 산출 키
  const lastMsByStage = useMemo(() => {
    const map: Record<MdrStage, MonitorMilestoneKey | null> = { SD: null, DD: null, CD: null };
    if (!headers) return map;
    headers.forEach(({ stage, ms }) => {
      map[stage] = ms.length ? ms[ms.length - 1] : null;
    });
    return map;
  }, [headers]);

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
            P=계획·A=실적·Δ=차이 · 단계 순차 강제(SD→DD→CD) 적용 · 기준일 일할 계산 · 단계 헤더 클릭 시 마일스톤 펼치기/접기
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
            {/* 1단 */}
            <tr className="border-b">
              <th rowSpan={3} className="text-left px-2 py-1 sticky left-0 bg-background border-r">Block</th>
              <th rowSpan={3} className="text-left px-2 py-1 border-r">Disc.</th>
              <th colSpan={3} className="text-center px-2 py-1 border-r border-l bg-muted text-black font-bold tracking-wider">
                Total DWG
              </th>
              <th colSpan={9} className="text-center px-2 py-1 border-r bg-slate-300 text-black font-bold tracking-wider">
                Overall Progress
              </th>
              {headers?.map(({ stage, ms }) => {
                const th = STAGE_THEME[stage];
                const isOpen = expanded[stage];
                const cols = isOpen ? Math.max(1, ms.length) * 3 : 1;
                return (
                  <th
                    key={`s-${stage}`}
                    colSpan={cols}
                    onClick={() => toggleStage(stage)}
                    className={`text-center px-2 py-1.5 border-l border-r font-bold tracking-wider text-black cursor-pointer select-none hover:brightness-95 ${th.head} ${th.border}`}
                    title={isOpen ? "클릭하여 접기" : "클릭하여 펼치기"}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {stage}
                    </span>
                  </th>
                );
              })}
            </tr>
            {/* 2단 */}
            <tr className="border-b">
              {(["SD","DD","CD"] as MdrStage[]).map((s, i) => {
                const th = STAGE_THEME[s];
                return (
                  <th
                    key={`dwgh-${s}`}
                    rowSpan={2}
                    className={`text-center px-2 py-1 border-l text-black font-bold ${th.sub} ${i === 2 ? "border-r" : ""}`}
                  >
                    {s}
                  </th>
                );
              })}
              {/* Overall Progress 2단: SD/DD/CD */}
              {STAGES.map((s, i) => {
                const th = STAGE_THEME[s];
                return (
                  <th
                    key={`op-h-${s}`}
                    colSpan={3}
                    className={`text-center px-2 py-1 border-l text-black font-bold ${th.sub} ${i === 2 ? "border-r" : ""}`}
                  >
                    {s}
                  </th>
                );
              })}
              {headers?.flatMap(({ stage, ms }) => {
                const th = STAGE_THEME[stage];
                if (!expanded[stage]) {
                  return [
                    <th
                      key={`collapsed-${stage}`}
                      rowSpan={2}
                      onClick={() => toggleStage(stage)}
                      className={`text-center px-1 py-0.5 border-l border-r text-[10px] text-muted-foreground cursor-pointer ${th.sub} ${th.border}`}
                      title="펼치기"
                    >
                      …
                    </th>
                  ];
                }
                return ms.length === 0 ? (
                  <th key={`empty-${stage}`} colSpan={3} className={`text-center px-2 py-0.5 border-l border-r text-muted-foreground text-[10px] ${th.sub}`}>
                    —
                  </th>
                ) : ms.map((m, i) => (
                  <th
                    key={`ms-${stage}-${m.pct}-${m.planDate}`}
                    colSpan={3}
                    className={`text-center px-1 py-1 border-l text-[10px] ${th.sub} ${i === ms.length - 1 ? "border-r " + th.border : ""}`}
                  >
                    <div className="flex flex-col items-center leading-tight">
                      {m.label && (
                        <span className={`text-[9px] italic font-bold ${th.text}`}>{m.label}</span>
                      )}
                      <span className={`tabular-nums font-bold ${th.text}`}>{fmtDate(m.planDate)}</span>
                      <span className={`text-[9px] font-semibold ${th.text}`}>{stage}{m.pct}%</span>
                    </div>
                  </th>
                ));
              })}
            </tr>
            {/* 3단 */}
            <tr className="border-b-2">
              {/* Overall Progress P/A/Δ */}
              {STAGES.map((s, i) => {
                const th = STAGE_THEME[s];
                const last = i === 2;
                return [
                  <th key={`op-p-${s}`} className={`text-center px-1 py-0.5 border-l font-bold text-black ${th.sub}`}>P</th>,
                  <th key={`op-a-${s}`} className={`text-center px-1 py-0.5 font-bold text-black ${th.sub}`}>A</th>,
                  <th key={`op-d-${s}`} className={`text-center px-1 py-0.5 font-bold text-black ${th.sub} ${last ? "border-r" : ""}`}>Δ</th>,
                ];
              })}
              {headers?.flatMap(({ stage, ms }) => {
                if (!expanded[stage]) return [];
                const th = STAGE_THEME[stage];
                const list = ms.length === 0 ? [{ pct: 0, planDate: null as string | null }] : ms;
                return list.flatMap((m, i) => {
                  const last = i === list.length - 1;
                  return [
                    <th key={`p-${stage}-${m.pct}-${m.planDate}`} className={`text-center px-1 py-0.5 border-l font-bold text-black ${th.sub}`}>P</th>,
                    <th key={`a-${stage}-${m.pct}-${m.planDate}`} className={`text-center px-1 py-0.5 font-bold text-black ${th.sub}`}>A</th>,
                    <th key={`d-${stage}-${m.pct}-${m.planDate}`} className={`text-center px-1 py-0.5 font-bold text-black ${th.sub} ${last ? "border-r " + th.border : ""}`}>Δ</th>,
                  ];
                });
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
                  <td className="text-center px-2 py-0.5 border-l tabular-nums">{row.drawingCountSD}</td>
                  <td className="text-center px-2 py-0.5 tabular-nums">{row.drawingCountDD}</td>
                  <td className="text-center px-2 py-0.5 border-r tabular-nums">{row.drawingCountCD}</td>
                  {/* Overall Progress 본문 */}
                  {STAGES.map((s, si) => {
                    const last = si === 2;
                    const lm = lastMsByStage[s];
                    const cell = lm ? row.cells.get(mkKey(s, lm.pct, lm.planDate)) : undefined;
                    if (!cell) {
                      return [
                        <td key={`op-p-${s}-${ri}`} className="text-center px-1 py-0.5 border-l text-muted-foreground">—</td>,
                        <td key={`op-a-${s}-${ri}`} className="text-center px-1 py-0.5 text-muted-foreground">—</td>,
                        <td key={`op-d-${s}-${ri}`} className={`text-center px-1 py-0.5 text-muted-foreground ${last ? "border-r" : ""}`}>—</td>,
                      ];
                    }
                    return [
                      <td key={`op-p-${s}-${ri}`} className="text-center px-1 py-0.5 border-l tabular-nums">{fmtPct(cell.plan)}</td>,
                      <td key={`op-a-${s}-${ri}`} className="text-center px-1 py-0.5 tabular-nums">{fmtPct(cell.actual)}</td>,
                      <td key={`op-d-${s}-${ri}`} className={`text-center px-1 py-0.5 tabular-nums ${deltaClass(cell.delta)} ${last ? "border-r" : ""}`}>{fmtDelta(cell.delta)}</td>,
                    ];
                  })}
                  {headers?.flatMap(({ stage, ms }) => {
                    if (!expanded[stage]) {
                      return [<td key={`col-${stage}-${ri}`} className="text-center px-1 py-0.5 border-l border-r text-muted-foreground">…</td>];
                    }
                    if (ms.length === 0) {
                      return [<td key={`empty-${stage}-${ri}`} colSpan={3} className="text-center px-1 py-0.5 border-l border-r text-muted-foreground">—</td>];
                    }
                    return ms.flatMap((m, mi) => {
                      const last = mi === ms.length - 1;
                      const cell = row.cells.get(mkKey(stage, m.pct, m.planDate));
                      if (!cell) {
                        return [
                          <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 border-l text-muted-foreground">—</td>,
                          <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 text-muted-foreground">—</td>,
                          <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} className={`text-center px-1 py-0.5 text-muted-foreground ${last ? "border-r" : ""}`}>—</td>,
                        ];
                      }
                      return [
                        <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 border-l tabular-nums">{fmtPct(cell.plan)}</td>,
                        <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} className="text-center px-1 py-0.5 tabular-nums">{fmtPct(cell.actual)}</td>,
                        <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} className={`text-center px-1 py-0.5 tabular-nums ${deltaClass(cell.delta)} ${last ? "border-r" : ""}`}>{fmtDelta(cell.delta)}</td>,
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
        ※ Overall Progress = 각 단계 마지막(최대 pct) 마일스톤의 P/A/Δ. 발행 이정표(IFR/IFA, IFC)는 별도 영역 추후 표시.
      </div>
    </Card>
  );
}
