/**
 * Progress 패널 (설계진도율).
 *  - Total DWG: SD/DD/CD 도면 합
 *  - Overall Progress: 각 단계의 마지막(최대 pct) 마일스톤 P/A/Δ
 *  - SD/DD/CD 마일스톤 컬럼: 단계별 토글 (기본 접힘)
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  computeMatrix,
  saveSnapshot,
  loadLatestSnapshot,
  loadLatestSnapshotMeta,
  loadLatestImportAt,
  type MonitorMatrix,
  type MonitorMilestoneKey,
  type MonitorDiscRow,
} from "@/lib/mdr/milestoneMonitorEngine";
import type { MdrStage } from "@/lib/mdr/parser";
import { MdrSummaryFilterBar, type SummaryFilterState } from "./MdrSummaryFilterBar";
import { normalizeDiscipline, TEAM_OF_DISCIPLINE, DEFAULT_STAGE_WF, TEAMS } from "@/lib/mdr/weights";

const WF_STORAGE_KEY = "mdr.monitor.wfEnabled";
const COL_WIDTHS_KEY = "mdr.monitor.columnWidths";
const DEFAULT_COL_W = 56;
const MIN_COL_W = 32;
const MAX_COL_W = 240;

type ColWidths = Record<string, number>;

function ResizeHandle({
  colKey,
  setWidths,
}: {
  colKey: string;
  setWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
}) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let startW = DEFAULT_COL_W;
    setWidths((prev) => {
      startW = prev[colKey] ?? DEFAULT_COL_W;
      return prev;
    });
    const move = (ev: MouseEvent) => {
      const next = Math.max(MIN_COL_W, Math.min(MAX_COL_W, startW + (ev.clientX - startX)));
      setWidths((p) => ({ ...p, [colKey]: next }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWidths((p) => {
      const n = { ...p };
      delete n[colKey];
      return n;
    });
  };
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary/70 z-10"
      title="드래그하여 너비 조절 · 더블클릭으로 기본값(56px) 복원"
    />
  );
}

const STAGES: MdrStage[] = ["SD", "DD", "CD"];

/** 건물 고정 정렬 순서: 공장동(GEN→SMP&CCM→HSM→CRM→FAFP) → 사무동(MAIN_OFFICE) */
const BUILDING_ORDER: string[] = ["GEN", "SMP&CCM", "HSM", "CRM", "FAFP", "MAIN_OFFICE"];
/** 공장동 분류 */
const FACTORY_BUILDINGS = new Set(["GEN", "SMP&CCM", "HSM", "CRM", "FAFP"]);
/** 공장동 마지막 건물 (이 건물 소계 직후 공장동 합계행 삽입) */
const LAST_FACTORY_BUILDING = "FAFP";

/** Sticky 좌측 고정 컬럼 — Block/Team/Disc + Total DWG(3) + Overall(3) + 각 Stage(3 또는 1).
 *  w=고정 폭(px), null=columnWidths[key] ?? DEFAULT_COL_W 사용. 동적(stage 토글) 생성. */
const BASE_STICKY_COLS: ReadonlyArray<{ key: string; w: number | null }> = [
  { key: "__block", w: 90 },
  { key: "__team", w: 70 },
  { key: "__disc", w: 60 },
  { key: "__dwg-SD", w: 44 },
  { key: "__dwg-DD", w: 44 },
  { key: "__dwg-CD", w: 44 },
  { key: "op-OVERALL-P", w: null },
  { key: "op-OVERALL-A", w: null },
  { key: "op-OVERALL-D", w: null },
];

/** Block 표시 라벨: 내부 코드 GEN → "GENERAL"로 표기. 그 외는 코드 그대로. */
const displayBuilding = (code: string): string => (code === "GEN" ? "GENERAL" : code);

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const v = n.toFixed(1);
  return n > 0 ? `+${v}%` : `${v}%`;
}
function deltaClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n) || Math.abs(n) < 0.05) return "text-muted-foreground";
  return n < 0 ? "text-destructive" : "text-primary";
}

function mkKey(stage: MdrStage, pct: number, planDate: string | null): string {
  return `${stage}|${pct}|${planDate ?? ""}`;
}

function weightedAvg(
  parts: Array<{ val: number | null | undefined; weight: number }>,
  weighted: boolean,
): number | null {
  let num = 0;
  let den = 0;
  for (const { val, weight } of parts) {
    if (val == null || !isFinite(val)) continue;
    const w = weighted ? Math.max(0, weight) : 1;
    if (w <= 0) continue;
    num += val * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

function getStageCount(r: MonitorDiscRow, s: MdrStage): number {
  return s === "SD" ? r.drawingCountSD : s === "DD" ? r.drawingCountDD : r.drawingCountCD;
}

/** SD/DD/CD 단계값을 합성해 Overall P/A/Δ 산출. WF ON → DEFAULT_STAGE_WF 가중평균, OFF → 단순평균. null 단계는 가중치에서 제외. */
function overallFromStages(
  triples: Partial<Record<MdrStage, { plan: number | null | undefined; actual: number | null | undefined } | null | undefined>>,
  weighted: boolean,
): { plan: number | null; actual: number | null; delta: number | null } {
  let pNum = 0, pDen = 0, aNum = 0, aDen = 0;
  for (const s of STAGES) {
    const v = triples[s];
    if (!v) continue;
    const w = weighted ? (DEFAULT_STAGE_WF[s] ?? 0) : 1;
    if (w <= 0) continue;
    if (v.plan != null && isFinite(v.plan as number)) { pNum += (v.plan as number) * w; pDen += w; }
    if (v.actual != null && isFinite(v.actual as number)) { aNum += (v.actual as number) * w; aDen += w; }
  }
  const plan = pDen > 0 ? pNum / pDen : null;
  const actual = aDen > 0 ? aNum / aDen : null;
  const delta = plan != null && actual != null ? actual - plan : null;
  return { plan, actual, delta };
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
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [latestImportAt, setLatestImportAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<MdrStage, boolean>>({ SD: false, DD: true, CD: false });
  /** Progress Status 내 SD/DD/CD Stage P/A/Δ 블록 펼침. 기본 모두 펼침. 접힘 시 Δ 1열만 노출. */
  const [stageColExpanded, setStageColExpanded] = useState<Record<MdrStage, boolean>>({ SD: true, DD: true, CD: true });
  const toggleStageCol = (s: MdrStage) => setStageColExpanded((p) => ({ ...p, [s]: !p[s] }));
  const [wfEnabled, setWfEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(WF_STORAGE_KEY);
    return v === null ? true : v === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WF_STORAGE_KEY, wfEnabled ? "1" : "0");
    }
  }, [wfEnabled]);

  // P/A/Δ 컬럼 너비 (localStorage 영속)
  const [columnWidths, setColumnWidths] = useState<ColWidths>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COL_WIDTHS_KEY);
      return raw ? (JSON.parse(raw) as ColWidths) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(columnWidths));
    } catch {
      // ignore quota errors
    }
  }, [columnWidths]);
  const colStyle = (k: string): React.CSSProperties => {
    const w = columnWidths[k] ?? DEFAULT_COL_W;
    return { width: w, minWidth: w, maxWidth: w };
  };

  // 동적 sticky 컬럼 (Stage 토글 반영)
  const stickyCols = useMemo(() => {
    const arr: Array<{ key: string; w: number | null }> = [...BASE_STICKY_COLS];
    for (const s of STAGES) {
      if (stageColExpanded[s]) {
        arr.push({ key: `op-${s}-P`, w: null }, { key: `op-${s}-A`, w: null }, { key: `op-${s}-D`, w: null });
      } else {
        // 접힘 — Δ 1열만 노출
        arr.push({ key: `op-${s}-D`, w: null });
      }
    }
    return arr;
  }, [stageColExpanded]);

  // sticky 컬럼의 누적 left 오프셋
  const stickyOffsets = useMemo(() => {
    const out: Record<string, number> = {};
    let acc = 0;
    for (const c of stickyCols) {
      out[c.key] = acc;
      const w = c.w ?? (columnWidths[c.key] ?? DEFAULT_COL_W);
      acc += w;
    }
    out.__total = acc;
    return out;
  }, [columnWidths, stickyCols]);
  const stickyKeyWidth = (key: string): number => {
    const c = stickyCols.find((x) => x.key === key);
    if (!c) return DEFAULT_COL_W;
    return c.w ?? (columnWidths[key] ?? DEFAULT_COL_W);
  };
  /** sticky cell style. leftKey = 시작 컬럼 키, spanKeys = colSpan 시 합산 폭(없으면 leftKey 단일). */
  const stickyStyle = (
    leftKey: string,
    opts?: { spanKeys?: string[]; zIndex?: number },
  ): React.CSSProperties => {
    const left = stickyOffsets[leftKey] ?? 0;
    const keys = opts?.spanKeys ?? [leftKey];
    const totalW = keys.reduce((a, k) => a + stickyKeyWidth(k), 0);
    return {
      position: "sticky",
      left,
      zIndex: opts?.zIndex ?? 5,
      width: totalW,
      minWidth: totalW,
      maxWidth: totalW,
    };
  };
  /** sticky 우측 경계(18번째 컬럼) 표시용 box-shadow */
  const STICKY_EDGE_SHADOW = "inset -2px 0 0 0 hsl(var(--border))";

  const toggleStage = (s: MdrStage) => setExpanded((p) => ({ ...p, [s]: !p[s] }));

  // 필터 — URL 동기화 (?b, ?t, ?d)
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: SummaryFilterState = {
    building: searchParams.get("b") ?? "all",
    team: searchParams.get("t") ?? "all",
    discipline: searchParams.get("d") ?? "all",
  };
  const setFilter = (next: SummaryFilterState) => {
    const sp = new URLSearchParams(searchParams);
    const apply = (k: string, v: string) => { if (v === "all") sp.delete(k); else sp.set(k, v); };
    apply("b", next.building); apply("t", next.team); apply("d", next.discipline);
    setSearchParams(sp, { replace: true });
  };

  // 초기 로드: 스냅샷 우선. 없으면 풀계산 후 저장.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [snap, meta, importedAt] = await Promise.all([
          loadLatestSnapshot(),
          loadLatestSnapshotMeta(),
          loadLatestImportAt(),
        ]);
        if (cancelled) return;
        if (snap) {
          setMatrix(snap);
          setAsOf(snap.asOf);
          setComputedAt(meta?.computedAt ?? null);
          setLatestImportAt(importedAt);
        } else {
          // 스냅샷 없음 — 최초 1회 풀계산 + 저장
          const today = new Date().toISOString().slice(0, 10);
          const m = await computeMatrix(today);
          if (cancelled) return;
          setMatrix(m);
          setAsOf(today);
          try {
            await saveSnapshot(m);
            const meta2 = await loadLatestSnapshotMeta();
            if (!cancelled) setComputedAt(meta2?.computedAt ?? new Date().toISOString());
          } catch {
            // 저장 실패해도 화면 표시는 유지
          }
          setLatestImportAt(importedAt);
        }
      } catch (e: any) {
        toast.error(`설계진도율 로드 실패: ${e?.message ?? e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRecompute = async () => {
    setRecomputing(true);
    const t = toast.loading("설계진도율 계산 중…");
    try {
      const m = await computeMatrix(asOf);
      setMatrix(m);
      await saveSnapshot(m);
      const meta = await loadLatestSnapshotMeta();
      setComputedAt(meta?.computedAt ?? new Date().toISOString());
      const importedAt = await loadLatestImportAt();
      setLatestImportAt(importedAt);
      toast.success(`신규 계산 완료 — 기준일 ${asOf}`, { id: t });
    } catch (e: any) {
      toast.error(`재계산 실패: ${e?.message ?? e}`, { id: t });
    } finally {
      setRecomputing(false);
    }
  };

  // 스냅샷 < 최신 임포트 → 재계산 필요
  const stale = !!(computedAt && latestImportAt && latestImportAt > computedAt);

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

  // 필터 적용된 행 (building → team → discipline 정렬)
  const displayRows = useMemo(() => {
    if (!matrix) return [];
    const filtered = matrix.rows.filter((r) => {
      if (filter.building !== "all" && r.building !== filter.building) return false;
      const disc = normalizeDiscipline(r.discipline);
      if (filter.discipline !== "all" && disc !== filter.discipline) return false;
      if (filter.team !== "all") {
        const team = TEAM_OF_DISCIPLINE[disc];
        if (team !== filter.team) return false;
      }
      return true;
    });
    // 안정 정렬: 고정 건물 순서, team, discipline
    const buildingRank = (b: string) => {
      const i = BUILDING_ORDER.indexOf(b);
      return i === -1 ? BUILDING_ORDER.length : i;
    };
    return [...filtered].sort((a, b) => {
      const ba = buildingRank(a.building);
      const bb = buildingRank(b.building);
      if (ba !== bb) return ba - bb;
      if (a.building !== b.building) return a.building.localeCompare(b.building);
      const ta = TEAM_OF_DISCIPLINE[normalizeDiscipline(a.discipline)] ?? "—";
      const tb = TEAM_OF_DISCIPLINE[normalizeDiscipline(b.discipline)] ?? "—";
      const teamRank = (t: string) => {
        const i = (TEAMS as readonly string[]).indexOf(t);
        return i === -1 ? TEAMS.length : i;
      };
      const tra = teamRank(ta);
      const trb = teamRank(tb);
      if (tra !== trb) return tra - trb;
      return a.discipline.localeCompare(b.discipline);
    });
  }, [matrix, filter.building, filter.team, filter.discipline]);

  // 공장동 행 모음 + 마지막 공장동 건물 (공장동 합계행 삽입 위치 판정)
  const factoryRows = useMemo(
    () => displayRows.filter((r) => FACTORY_BUILDINGS.has(r.building)),
    [displayRows],
  );
  const lastFactoryBuilding = useMemo(() => {
    for (let i = factoryRows.length - 1; i >= 0; i--) return factoryRows[i].building;
    return null;
  }, [factoryRows]);




  const buildings = useMemo(
    () => (matrix ? Array.from(new Set(matrix.rows.map((r) => r.building))) : []),
    [matrix],
  );

  // 합계행 렌더러 (건물별 / 전체) — WF 토글 반영(ON=도면수 가중평균, OFF=단순평균)
  const renderAggRow = (
    label: string,
    rows: MonitorDiscRow[],
    variant: "building" | "factory" | "grand",
  ) => {
    const sdSum = rows.reduce((a, r) => a + r.drawingCountSD, 0);
    const ddSum = rows.reduce((a, r) => a + r.drawingCountDD, 0);
    const cdSum = rows.reduce((a, r) => a + r.drawingCountCD, 0);
    const bgCls =
      variant === "grand"
        ? "bg-orange-300/80 dark:bg-orange-900/60 font-bold"
        : variant === "factory"
        ? "bg-orange-200/80 dark:bg-orange-900/45 font-semibold"
        : "bg-orange-100/80 dark:bg-orange-900/30 font-semibold";
    const borderCls =
      variant === "grand"
        ? "border-t-2 border-b-2 border-orange-600/80"
        : variant === "factory"
        ? "border-t border-b-2 border-orange-500/70"
        : "border-b-2 border-orange-400/60";
    const displayLabel =
      variant === "grand" ? "프로젝트 전체" : variant === "factory" ? "공장동 합계" : `${label} 합계`;
    return (
      <tr key={`agg-${variant}-${label}`} className={`${bgCls} ${borderCls}`}>
        <td
          colSpan={3}
          style={{ position: "sticky", left: 0, zIndex: 5, width: 220, minWidth: 220, maxWidth: 220 }}
          className="px-2 py-1 border-r text-[11px] bg-inherit"
        >
          {displayLabel}
        </td>
        <td style={{ position: "sticky", left: stickyOffsets["__dwg-SD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-1 border-l tabular-nums bg-inherit">{sdSum}</td>
        <td style={{ position: "sticky", left: stickyOffsets["__dwg-DD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-1 tabular-nums bg-inherit">{ddSum}</td>
        <td style={{ position: "sticky", left: stickyOffsets["__dwg-CD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-1 border-r tabular-nums bg-inherit">{cdSum}</td>
        {(() => {
          // 단계별 집계값 선계산 (Overall 합성에도 재사용)
          const stageVals: Record<MdrStage, { plan: number | null; actual: number | null; delta: number | null }> = {
            SD: { plan: null, actual: null, delta: null },
            DD: { plan: null, actual: null, delta: null },
            CD: { plan: null, actual: null, delta: null },
          };
          for (const s of STAGES) {
            // stage 대표값은 WF 토글과 무관하게 항상 Summary 산식(row.stageW)을 사용
            const parts = rows.map((r) => {
              const sw = r.stageW?.[s];
              return { plan: sw?.plan ?? null, actual: sw?.actual ?? null, weight: getStageCount(r, s) };
            });
            const plan = weightedAvg(parts.map((p) => ({ val: p.plan, weight: p.weight })), wfEnabled);
            const actual = weightedAvg(parts.map((p) => ({ val: p.actual, weight: p.weight })), wfEnabled);
            stageVals[s] = { plan, actual, delta: plan != null && actual != null ? actual - plan : null };
          }
          const overall = overallFromStages(stageVals, wfEnabled);
          const aStick = (k: string, extra?: React.CSSProperties): React.CSSProperties => ({
            ...colStyle(k),
            position: "sticky",
            left: stickyOffsets[k],
            zIndex: 5,
            ...extra,
          });
          return [
            // Overall 3셀
            <td key="agg-op-p-OVERALL" style={aStick("op-OVERALL-P")} className="text-center px-1 py-1 border-l tabular-nums bg-inherit">{fmtPct(overall.plan)}</td>,
            <td key="agg-op-a-OVERALL" style={aStick("op-OVERALL-A")} className="text-center px-1 py-1 tabular-nums bg-inherit">{fmtPct(overall.actual)}</td>,
            <td key="agg-op-d-OVERALL" style={aStick("op-OVERALL-D")} className={`text-center px-1 py-1 tabular-nums bg-inherit ${deltaClass(overall.delta)}`}>{fmtDelta(overall.delta)}</td>,
            // SD/DD/CD Stage 셀 (접힘 시 Δ 1열)
            ...STAGES.flatMap((s, si) => {
              const last = si === 2;
              const { plan, actual, delta } = stageVals[s];
              const edge = last ? { boxShadow: STICKY_EDGE_SHADOW } : undefined;
              if (!stageColExpanded[s]) {
                return [
                  <td
                    key={`agg-op-d-${s}`}
                    style={aStick(`op-${s}-D`, edge)}
                    className={`text-center px-1 py-1 border-l tabular-nums bg-inherit ${deltaClass(delta)} ${last ? "border-r" : ""}`}
                    title={`P ${fmtPct(plan)} / A ${fmtPct(actual)}`}
                  >
                    {fmtDelta(delta)}
                  </td>,
                ];
              }
              return [
                <td key={`agg-op-p-${s}`} style={aStick(`op-${s}-P`)} className="text-center px-1 py-1 border-l tabular-nums bg-inherit">{fmtPct(plan)}</td>,
                <td key={`agg-op-a-${s}`} style={aStick(`op-${s}-A`)} className="text-center px-1 py-1 tabular-nums bg-inherit">{fmtPct(actual)}</td>,
                <td key={`agg-op-d-${s}`} style={aStick(`op-${s}-D`, edge)} className={`text-center px-1 py-1 tabular-nums bg-inherit ${deltaClass(delta)} ${last ? "border-r" : ""}`}>{fmtDelta(delta)}</td>,
              ];
            }),
          ];
        })()}

        {headers?.flatMap(({ stage, ms }) => {
          if (!expanded[stage]) {
            return [<td key={`agg-col-${stage}`} className="text-center px-1 py-1 border-l border-r text-muted-foreground">…</td>];
          }
          if (ms.length === 0) {
            return [<td key={`agg-empty-${stage}`} colSpan={3} className="text-center px-1 py-1 border-l border-r text-muted-foreground">—</td>];
          }
          return ms.flatMap((m, mi) => {
            const last = mi === ms.length - 1;
            const parts = rows.map((r) => {
              const c = r.cells.get(mkKey(stage, m.pct, m.planDate));
              return { plan: c?.plan ?? null, actual: c?.actual ?? null, weight: getStageCount(r, stage) };
            });
            const plan = weightedAvg(parts.map((p) => ({ val: p.plan, weight: p.weight })), wfEnabled);
            const actual = weightedAvg(parts.map((p) => ({ val: p.actual, weight: p.weight })), wfEnabled);
            const delta = plan != null && actual != null ? actual - plan : null;
            return [
              <td key={`agg-p-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-P`)} className="text-center px-1 py-1 border-l tabular-nums">{fmtPct(plan)}</td>,
              <td key={`agg-a-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-A`)} className="text-center px-1 py-1 tabular-nums">{fmtPct(actual)}</td>,
              <td key={`agg-d-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-D`)} className={`text-center px-1 py-1 tabular-nums ${deltaClass(delta)} ${last ? "border-r" : ""}`}>{fmtDelta(delta)}</td>,
            ];
          });
        })}
      </tr>
    );
  };


  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 설계진도율 로드 중…
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
    <div className="space-y-3">
    <MdrSummaryFilterBar buildings={buildings} value={filter} onChange={setFilter} />
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Design Progress Status
            {computedAt && (
              <span className="text-[10px] font-normal text-muted-foreground">
                · 최종 계산 {new Date(computedAt).toLocaleString("ko-KR", { hour12: false })}
              </span>
            )}
            {stale && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/40">
                임포트 이후 변경 — 재계산 필요
              </span>
            )}
          </h3>
          <div className="text-[10px] text-muted-foreground">
            P=계획·A=실적·Δ=차이 · 단계 순차 강제(SD→DD→CD) 적용 · 기준일 일할 계산 · 단계 헤더 클릭 시 마일스톤 펼치기/접기
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded border text-[11px] ${
              wfEnabled ? "border-primary/40 bg-primary/5" : "border-muted bg-muted/30"
            }`}
            title="WF 적용: Overall Progress 를 Summary 와 동일한 산식(단계별 도면 평균)으로 표시"
          >
            <span className={`font-semibold ${wfEnabled ? "text-primary" : "text-muted-foreground"}`}>
              WF {wfEnabled ? "적용" : "미적용"}
            </span>
            <Switch checked={wfEnabled} onCheckedChange={setWfEnabled} aria-label="WF 적용 토글" />
          </div>
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
              <th
                rowSpan={3}
                style={{ position: "sticky", left: 0, zIndex: 15, width: 90, minWidth: 90, maxWidth: 90 }}
                className="text-left px-2 py-1 bg-background border-r"
              >
                Block
              </th>
              <th
                rowSpan={3}
                style={{ position: "sticky", left: stickyOffsets.__team, zIndex: 15, width: 70, minWidth: 70, maxWidth: 70 }}
                className="text-left px-2 py-1 bg-background border-r"
              >
                Team
              </th>
              <th
                rowSpan={3}
                style={{ position: "sticky", left: stickyOffsets.__disc, zIndex: 15, width: 60, minWidth: 60, maxWidth: 60 }}
                className="text-left px-2 py-1 bg-background border-r"
              >
                Disc.
              </th>
              <th
                colSpan={3}
                style={{ position: "sticky", left: stickyOffsets["__dwg-SD"], zIndex: 15 }}
                className="text-center px-2 py-1 border-r border-l bg-muted text-black font-bold tracking-wider"
              >
                Total DWG
              </th>
              <th
                colSpan={3 + STAGES.reduce((a, s) => a + (stageColExpanded[s] ? 3 : 1), 0)}
                style={{ position: "sticky", left: stickyOffsets["op-OVERALL-P"], zIndex: 15, boxShadow: STICKY_EDGE_SHADOW }}
                className="text-center px-2 py-1 border-r bg-slate-300 text-black font-bold tracking-wider"
              >
                Progress Status
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
                    style={{ position: "sticky", left: stickyOffsets[`__dwg-${s}`], zIndex: 15, width: 44, minWidth: 44, maxWidth: 44 }}
                    className={`text-center px-2 py-1 border-l text-black font-bold ${th.sub} ${i === 2 ? "border-r" : ""}`}
                  >
                    {s}
                  </th>
                );
              })}
              {/* Progress Status 2단: Overall / SD Stage / DD Stage / CD Stage */}
              <th
                key="op-h-OVERALL"
                colSpan={3}
                style={{ position: "sticky", left: stickyOffsets["op-OVERALL-P"], zIndex: 15 }}
                className="text-center px-2 py-1 border-l text-black font-bold bg-slate-200"
              >
                Overall
              </th>
              {STAGES.map((s, i) => {
                const th = STAGE_THEME[s];
                const last = i === 2;
                const isOpen = stageColExpanded[s];
                const leftKey = isOpen ? `op-${s}-P` : `op-${s}-D`;
                return (
                  <th
                    key={`op-h-${s}`}
                    colSpan={isOpen ? 3 : 1}
                    onClick={() => toggleStageCol(s)}
                    style={{ position: "sticky", left: stickyOffsets[leftKey], zIndex: 15, boxShadow: last ? STICKY_EDGE_SHADOW : undefined }}
                    className={`text-center px-2 py-1 border-l text-black font-bold cursor-pointer select-none hover:brightness-95 ${th.sub} ${last ? "border-r" : ""}`}
                    title={isOpen ? "클릭하여 접기" : "클릭하여 펼치기 (P/A/Δ)"}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {s}{isOpen ? " Stage" : ""}
                    </span>
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
              {/* Overall P/A/Δ (Stage WF 합성) */}
              <th key="op-p-OVERALL" style={{ ...colStyle(`op-OVERALL-P`), position: "sticky", left: stickyOffsets["op-OVERALL-P"], zIndex: 15 }} className="relative text-center px-1 py-0.5 border-l font-bold text-black bg-slate-200">P<ResizeHandle colKey={`op-OVERALL-P`} setWidths={setColumnWidths} /></th>
              <th key="op-a-OVERALL" style={{ ...colStyle(`op-OVERALL-A`), position: "sticky", left: stickyOffsets["op-OVERALL-A"], zIndex: 15 }} className="relative text-center px-1 py-0.5 font-bold text-black bg-slate-200">A<ResizeHandle colKey={`op-OVERALL-A`} setWidths={setColumnWidths} /></th>
              <th key="op-d-OVERALL" style={{ ...colStyle(`op-OVERALL-D`), position: "sticky", left: stickyOffsets["op-OVERALL-D"], zIndex: 15 }} className="relative text-center px-1 py-0.5 font-bold text-black bg-slate-200">Δ<ResizeHandle colKey={`op-OVERALL-D`} setWidths={setColumnWidths} /></th>
              {/* SD/DD/CD Stage P/A/Δ (접힘 시 Δ 1열) */}
              {STAGES.map((s, i) => {
                const th = STAGE_THEME[s];
                const last = i === 2;
                const dShadow = last ? STICKY_EDGE_SHADOW : undefined;
                if (!stageColExpanded[s]) {
                  return (
                    <th key={`op-d-${s}`} style={{ ...colStyle(`op-${s}-D`), position: "sticky", left: stickyOffsets[`op-${s}-D`], zIndex: 15, boxShadow: dShadow }} className={`relative text-center px-1 py-0.5 border-l font-bold text-black ${th.sub} ${last ? "border-r" : ""}`}>Δ<ResizeHandle colKey={`op-${s}-D`} setWidths={setColumnWidths} /></th>
                  );
                }
                return [
                  <th key={`op-p-${s}`} style={{ ...colStyle(`op-${s}-P`), position: "sticky", left: stickyOffsets[`op-${s}-P`], zIndex: 15 }} className={`relative text-center px-1 py-0.5 border-l font-bold text-black ${th.sub}`}>P<ResizeHandle colKey={`op-${s}-P`} setWidths={setColumnWidths} /></th>,
                  <th key={`op-a-${s}`} style={{ ...colStyle(`op-${s}-A`), position: "sticky", left: stickyOffsets[`op-${s}-A`], zIndex: 15 }} className={`relative text-center px-1 py-0.5 font-bold text-black ${th.sub}`}>A<ResizeHandle colKey={`op-${s}-A`} setWidths={setColumnWidths} /></th>,
                  <th key={`op-d-${s}`} style={{ ...colStyle(`op-${s}-D`), position: "sticky", left: stickyOffsets[`op-${s}-D`], zIndex: 15, boxShadow: dShadow }} className={`relative text-center px-1 py-0.5 font-bold text-black ${th.sub} ${last ? "border-r" : ""}`}>Δ<ResizeHandle colKey={`op-${s}-D`} setWidths={setColumnWidths} /></th>,
                ];
              })}
              {headers?.flatMap(({ stage, ms }) => {
                if (!expanded[stage]) return [];
                const th = STAGE_THEME[stage];
                const list = ms.length === 0 ? [{ pct: 0, planDate: null as string | null }] : ms;
                return list.flatMap((m, i) => {
                  const last = i === list.length - 1;
                  return [
                    <th key={`p-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-P`)} className={`relative text-center px-1 py-0.5 border-l font-bold text-black ${th.sub}`}>P<ResizeHandle colKey={`ms-${stage}-${m.pct}-${m.planDate}-P`} setWidths={setColumnWidths} /></th>,
                    <th key={`a-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-A`)} className={`relative text-center px-1 py-0.5 font-bold text-black ${th.sub}`}>A<ResizeHandle colKey={`ms-${stage}-${m.pct}-${m.planDate}-A`} setWidths={setColumnWidths} /></th>,
                    <th key={`d-${stage}-${m.pct}-${m.planDate}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-D`)} className={`relative text-center px-1 py-0.5 font-bold text-black ${th.sub} ${last ? "border-r " + th.border : ""}`}>Δ<ResizeHandle colKey={`ms-${stage}-${m.pct}-${m.planDate}-D`} setWidths={setColumnWidths} /></th>,
                  ];
                });
              })}
            </tr>
          </thead>

          <tbody>
            {displayRows.length === 0 && (
              <tr><td colSpan={99} className="text-center px-2 py-4 text-muted-foreground text-[11px]">필터 조건에 해당하는 행이 없습니다.</td></tr>
            )}
            {displayRows.map((row, ri) => {
              const prev = ri > 0 ? displayRows[ri - 1] : null;
              const rowTeam = TEAM_OF_DISCIPLINE[normalizeDiscipline(row.discipline)] ?? "—";
              const showBlock = !prev || prev.building !== row.building;
              const blockRowSpan = displayRows.filter((r) => r.building === row.building).length;
              const prevTeam = prev ? (TEAM_OF_DISCIPLINE[normalizeDiscipline(prev.discipline)] ?? "—") : null;
              const showTeam = !prev || prev.building !== row.building || prevTeam !== rowTeam;
              const teamRowSpan = displayRows.filter((r) => r.building === row.building && (TEAM_OF_DISCIPLINE[normalizeDiscipline(r.discipline)] ?? "—") === rowTeam).length;
              const isLastOfBuilding = !displayRows[ri + 1] || displayRows[ri + 1].building !== row.building;
              return (
                <Fragment key={`${row.building}-${row.discipline}`}>
                <tr className="border-b hover:bg-muted/20">
                  {showBlock && (
                    <td
                      rowSpan={blockRowSpan}
                      style={{ position: "sticky", left: 0, zIndex: 5, width: 90, minWidth: 90, maxWidth: 90 }}
                      className="px-2 py-0.5 bg-background font-semibold border-r align-top"
                    >
                      {displayBuilding(row.building)}
                    </td>
                  )}
                  {showTeam && (
                    <td
                      rowSpan={teamRowSpan}
                      style={{ position: "sticky", left: stickyOffsets.__team, zIndex: 5, width: 70, minWidth: 70, maxWidth: 70 }}
                      className="px-2 py-0.5 border-r align-top text-xs font-medium bg-background"
                    >
                      {rowTeam}
                    </td>
                  )}
                  <td style={{ position: "sticky", left: stickyOffsets.__disc, zIndex: 5, width: 60, minWidth: 60, maxWidth: 60 }} className="px-2 py-0.5 border-r bg-background">{row.discipline}</td>
                  <td style={{ position: "sticky", left: stickyOffsets["__dwg-SD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-0.5 border-l tabular-nums bg-background">{row.drawingCountSD}</td>
                  <td style={{ position: "sticky", left: stickyOffsets["__dwg-DD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-0.5 tabular-nums bg-background">{row.drawingCountDD}</td>
                  <td style={{ position: "sticky", left: stickyOffsets["__dwg-CD"], zIndex: 5, width: 44, minWidth: 44, maxWidth: 44 }} className="text-center px-2 py-0.5 border-r tabular-nums bg-background">{row.drawingCountCD}</td>
                  {/* Progress Status 본문 — Overall + SD/DD/CD Stage. stage 대표값은 항상 row.stageW(Summary 산식) 사용 */}
                  {(() => {
                    const stageSrc: Record<MdrStage, { plan: number | null; actual: number | null; delta: number | null } | null> = {
                      SD: null, DD: null, CD: null,
                    };
                    for (const s of STAGES) {
                      const sw = row.stageW?.[s];
                      stageSrc[s] = sw ? { plan: sw.plan, actual: sw.actual, delta: sw.delta } : null;
                    }
                    const overall = overallFromStages(stageSrc, wfEnabled);
                    const overallEmpty = overall.plan == null && overall.actual == null;
                    const ovBg = "bg-slate-100 dark:bg-slate-900";
                    const sStick = (k: string, extra?: React.CSSProperties): React.CSSProperties => ({
                      ...colStyle(k),
                      position: "sticky",
                      left: stickyOffsets[k],
                      zIndex: 5,
                      ...extra,
                    });
                    const cells: JSX.Element[] = [
                      overallEmpty
                        ? <td key={`op-p-OVERALL-${ri}`} style={sStick("op-OVERALL-P")} className={`text-center px-1 py-0.5 border-l text-muted-foreground ${ovBg}`}>—</td>
                        : <td key={`op-p-OVERALL-${ri}`} style={sStick("op-OVERALL-P")} className={`text-center px-1 py-0.5 border-l tabular-nums ${ovBg}`}>{fmtPct(overall.plan)}</td>,
                      overallEmpty
                        ? <td key={`op-a-OVERALL-${ri}`} style={sStick("op-OVERALL-A")} className={`text-center px-1 py-0.5 text-muted-foreground ${ovBg}`}>—</td>
                        : <td key={`op-a-OVERALL-${ri}`} style={sStick("op-OVERALL-A")} className={`text-center px-1 py-0.5 tabular-nums ${ovBg}`}>{fmtPct(overall.actual)}</td>,
                      overallEmpty
                        ? <td key={`op-d-OVERALL-${ri}`} style={sStick("op-OVERALL-D")} className={`text-center px-1 py-0.5 text-muted-foreground ${ovBg}`}>—</td>
                        : <td key={`op-d-OVERALL-${ri}`} style={sStick("op-OVERALL-D")} className={`text-center px-1 py-0.5 tabular-nums ${ovBg} ${deltaClass(overall.delta)}`}>{fmtDelta(overall.delta)}</td>,
                    ];
                    STAGES.forEach((s, si) => {
                      const last = si === 2;
                      const useSrc = stageSrc[s];
                      const edgeShadow = last ? { boxShadow: STICKY_EDGE_SHADOW } : undefined;
                      if (!useSrc) {
                        cells.push(
                          <td key={`op-p-${s}-${ri}`} style={sStick(`op-${s}-P`)} className="text-center px-1 py-0.5 border-l text-muted-foreground bg-background">—</td>,
                          <td key={`op-a-${s}-${ri}`} style={sStick(`op-${s}-A`)} className="text-center px-1 py-0.5 text-muted-foreground bg-background">—</td>,
                          <td key={`op-d-${s}-${ri}`} style={sStick(`op-${s}-D`, edgeShadow)} className={`text-center px-1 py-0.5 text-muted-foreground bg-background ${last ? "border-r" : ""}`}>—</td>,
                        );
                      } else {
                        cells.push(
                          <td key={`op-p-${s}-${ri}`} style={sStick(`op-${s}-P`)} className="text-center px-1 py-0.5 border-l tabular-nums bg-background">{fmtPct(useSrc.plan)}</td>,
                          <td key={`op-a-${s}-${ri}`} style={sStick(`op-${s}-A`)} className="text-center px-1 py-0.5 tabular-nums bg-background">{fmtPct(useSrc.actual)}</td>,
                          <td key={`op-d-${s}-${ri}`} style={sStick(`op-${s}-D`, edgeShadow)} className={`text-center px-1 py-0.5 tabular-nums bg-background ${deltaClass(useSrc.delta)} ${last ? "border-r" : ""}`}>{fmtDelta(useSrc.delta)}</td>,
                        );
                      }
                    });
                    return cells;
                  })()}

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
                          <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-P`)} className="text-center px-1 py-0.5 border-l text-muted-foreground">—</td>,
                          <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-A`)} className="text-center px-1 py-0.5 text-muted-foreground">—</td>,
                          <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-D`)} className={`text-center px-1 py-0.5 text-muted-foreground ${last ? "border-r" : ""}`}>—</td>,
                        ];
                      }
                      const warnCls = cell.warn ? "bg-pink-500/25 dark:bg-pink-500/30" : "";
                      return [
                        <td key={`p-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-P`)} className="text-center px-1 py-0.5 border-l tabular-nums">{fmtPct(cell.plan)}</td>,
                        <td key={`a-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-A`)} className={`text-center px-1 py-0.5 tabular-nums ${warnCls}`} title={cell.warn ? "이전 마일스톤 대비 실적이 같거나 감소 — 역진행/정체 경고" : undefined}>{fmtPct(cell.actual)}</td>,
                        <td key={`d-${stage}-${m.pct}-${m.planDate}-${ri}`} style={colStyle(`ms-${stage}-${m.pct}-${m.planDate}-D`)} className={`text-center px-1 py-0.5 tabular-nums ${deltaClass(cell.delta)} ${warnCls} ${last ? "border-r" : ""}`}>{fmtDelta(cell.delta)}</td>,
                      ];
                    });
                  })}
                </tr>
                {isLastOfBuilding && renderAggRow(displayBuilding(row.building), displayRows.filter((r) => r.building === row.building), "building")}
                {isLastOfBuilding && row.building === lastFactoryBuilding && factoryRows.length > 0 && (
                  renderAggRow("공장동", factoryRows, "factory")
                )}
                </Fragment>
              );
            })}
            {displayRows.length > 0 && renderAggRow("프로젝트 전체", displayRows, "grand")}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <div>※ Overall Progress — WF 적용: Summary 산식(plan_date·actual_date ≤ 기준일 기준 도면 평균). WF 미적용: 각 단계 마지막 마일스톤의 P/A/Δ(일할 보간). 토글로 전환 (기본 WF 적용).</div>
        <div>※ 기준일 미도래(planDate &gt; 기준일) 마일스톤의 A/Δ 는 표시하지 않습니다(—).</div>
        <div>※ <span className="inline-block w-3 h-3 align-middle bg-pink-500/25 dark:bg-pink-500/30 border border-pink-500/40" /> 핑크 = 동일 단계 직전 마일스톤 대비 A 가 같거나 감소 → 역진행/정체 경고.</div>
      </div>
    </Card>
    </div>
  );
}
