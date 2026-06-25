/**
 * 마일스톤 모니터링 — Block × Discipline 행, Stage × 마일스톤 × {P,A,Δ} 컬럼.
 * 도면별 cell-level 계획(`drawingMilestonePlannedPct`) 과 실적(`actualPctUpTo`) 을
 * 도면 가중평균(mdr_weights 없는 경우 단순평균)으로 집계.
 *
 * 캐시: `mdr_milestone_snapshots` 테이블에 (as_of, building, discipline, stage, pct) UNIQUE upsert.
 *   - 일반 로드: 최신 snapshot 그대로 표시 + 기준일 이후 가장 가까운 1개 마일스톤만 재계산.
 *   - `recomputeAll: true`: 모든 마일스톤 재계산 후 upsert.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  drawingMilestonePlannedPct,
  actualPctUpTo,
  type MilestoneRow,
  type ProgressRow,
  type MilestoneCellRow,
} from "./progressEngine";
import { normalizeDiscipline, type StageCode } from "./weights";
import type { MdrStage } from "./parser";

export interface MonitorMilestoneKey {
  stage: MdrStage;
  pct: number;
  planDate: string | null;
  label?: string | null;
}

export interface MonitorCell {
  plan: number;     // 0~100
  actual: number;   // 0~100
  delta: number;    // actual - plan
  drawingCount: number;
}

/** WF(가중) 적용 모드용 단계별 P/A — Summary 산식(planAtDate / actualAtDate)으로 도면 평균 */
export interface MonitorStageW {
  plan: number;   // 0~100
  actual: number; // 0~100
  delta: number;
}

export interface MonitorDiscRow {
  building: string;
  discipline: string;
  drawingCount: number;
  drawingCountSD: number;
  drawingCountDD: number;
  drawingCountCD: number;
  cells: Map<string, MonitorCell>; // key = `${stage}|${pct}|${planDate ?? ''}`
  /** WF 적용 모드 — 단계별 (Summary 산식). 스냅샷에 없으면 fallback 으로 last-milestone 값을 채움. */
  stageW: Record<MdrStage, MonitorStageW>;
}

export interface MonitorMatrix {
  asOf: string;
  milestonesByStage: Record<MdrStage, MonitorMilestoneKey[]>;
  rows: MonitorDiscRow[];
  buildings: string[];
}

interface RawDrawing {
  id: string;
  building_code: string;
  discipline: string | null;
  out_of_scope: boolean;
  in_scope_sd: boolean | null;
  in_scope_dd: boolean | null;
  in_scope_cd: boolean | null;
  mdr_milestones: { stage: MdrStage; pct: number; plan_date: string | null; increment_pct: number }[] | null;
  mdr_milestone_cells: { stage: MdrStage; pct: number; sub_idx: number; increment_pct: number; plan_date: string | null; label: string | null }[] | null;
  mdr_progress: { stage: MdrStage; pct: number; sub_idx: number | null; is_done: boolean; actual_date: string | null }[] | null;
}

const STAGES: MdrStage[] = ["SD", "DD", "CD"];

function mkKey(stage: MdrStage, pct: number, planDate: string | null): string {
  return `${stage}|${pct}|${planDate ?? ""}`;
}

function isInScope(d: RawDrawing, stage: MdrStage): boolean {
  const explicit = d.in_scope_sd !== null || d.in_scope_dd !== null || d.in_scope_cd !== null;
  if (explicit) {
    if (stage === "SD") return !!d.in_scope_sd;
    if (stage === "DD") return !!d.in_scope_dd;
    return !!d.in_scope_cd;
  }
  return !!d.mdr_milestones?.some((m) => m.stage === stage && (m.plan_date || m.pct > 0));
}

async function loadDrawings(): Promise<RawDrawing[]> {
  const PAGE = 1000;
  const rows: RawDrawing[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("id, building_code, discipline, out_of_scope, in_scope_sd, in_scope_dd, in_scope_cd, mdr_milestones(stage,pct,plan_date,increment_pct), mdr_milestone_cells(stage,pct,sub_idx,increment_pct,plan_date,label), mdr_progress(stage,pct,sub_idx,is_done,actual_date)")
      .eq("out_of_scope", false)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = ((data as unknown) as RawDrawing[]) ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

/** Block × Discipline 별 in-scope 도면 개수(전체/SD/DD/CD) 라이브 집계 */
async function fetchDrawingCountsByGroup(): Promise<Map<string, { total: number; sd: number; dd: number; cd: number }>> {
  const PAGE = 1000;
  const map = new Map<string, { total: number; sd: number; dd: number; cd: number }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("building_code, discipline, in_scope_sd, in_scope_dd, in_scope_cd")
      .eq("out_of_scope", false)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = ((data as unknown) as { building_code: string | null; discipline: string | null; in_scope_sd: boolean | null; in_scope_dd: boolean | null; in_scope_cd: boolean | null }[]) ?? [];
    for (const r of chunk) {
      if (!r.building_code) continue;
      const k = `${r.building_code}||${normalizeDiscipline(r.discipline)}`;
      const v = map.get(k) ?? { total: 0, sd: 0, dd: 0, cd: 0 };
      v.total += 1;
      if (r.in_scope_sd) v.sd += 1;
      if (r.in_scope_dd) v.dd += 1;
      if (r.in_scope_cd) v.cd += 1;
      map.set(k, v);
    }
    if (chunk.length < PAGE) break;
  }
  return map;
}

/** 컴퓨팅: 도면들 → Block×Discipline 매트릭스 */
export function buildMatrix(drawings: RawDrawing[], asOf: string): MonitorMatrix {
  // 1) 도면별 (stage,pct,planDate) 마일스톤 키 수집
  const keySetByStage: Record<MdrStage, Map<string, MonitorMilestoneKey>> = {
    SD: new Map(), DD: new Map(), CD: new Map(),
  };
  for (const d of drawings) {
    for (const m of d.mdr_milestones ?? []) {
      if (!STAGES.includes(m.stage)) continue;
      if (!isInScope(d, m.stage)) continue;
      const k = mkKey(m.stage, m.pct, m.plan_date ?? null);
      if (!keySetByStage[m.stage].has(k)) {
        // STR 라벨은 cells 의 label 에서 가져옴
        const label = d.mdr_milestone_cells?.find((c) => c.stage === m.stage && c.pct === m.pct && c.label)?.label ?? null;
        keySetByStage[m.stage].set(k, { stage: m.stage, pct: m.pct, planDate: m.plan_date ?? null, label });
      }
    }
  }
  const milestonesByStage: Record<MdrStage, MonitorMilestoneKey[]> = {
    SD: [...keySetByStage.SD.values()].sort(sortMs),
    DD: [...keySetByStage.DD.values()].sort(sortMs),
    CD: [...keySetByStage.CD.values()].sort(sortMs),
  };

  // 2) Block × Discipline → 도면 그룹
  const groupMap = new Map<string, { building: string; discipline: string; drawings: RawDrawing[] }>();
  for (const d of drawings) {
    if (!d.building_code) continue;
    const disc = normalizeDiscipline(d.discipline);
    const gKey = `${d.building_code}||${disc}`;
    const g = groupMap.get(gKey) ?? { building: d.building_code, discipline: disc, drawings: [] };
    g.drawings.push(d);
    groupMap.set(gKey, g);
  }

  const rows: MonitorDiscRow[] = [];
  for (const g of groupMap.values()) {
    const cntSD = g.drawings.filter((d) => isInScope(d, "SD")).length;
    const cntDD = g.drawings.filter((d) => isInScope(d, "DD")).length;
    const cntCD = g.drawings.filter((d) => isInScope(d, "CD")).length;
    const row: MonitorDiscRow = {
      building: g.building, discipline: g.discipline,
      drawingCount: g.drawings.length,
      drawingCountSD: cntSD, drawingCountDD: cntDD, drawingCountCD: cntCD,
      cells: new Map(),
    };
    // 각 마일스톤 key 별로 P/A 평균
    for (const stage of STAGES) {
      for (const ms of milestonesByStage[stage]) {
        const matching = g.drawings.filter((d) =>
          isInScope(d, stage) &&
          (d.mdr_milestones ?? []).some((m) => m.stage === stage && m.pct === ms.pct && (m.plan_date ?? null) === ms.planDate),
        );
        if (matching.length === 0) continue;
        let pSum = 0, aSum = 0;
        for (const d of matching) {
          const milestones: MilestoneRow[] = (d.mdr_milestones ?? []).map((m) => ({
            stage: m.stage, pct: m.pct, incrementPct: Number(m.increment_pct) || 0,
            planDate: m.plan_date ?? null,
          }));
          const cells: MilestoneCellRow[] = (d.mdr_milestone_cells ?? []).map((c) => ({
            stage: c.stage, pct: c.pct, subIdx: c.sub_idx,
            incrementPct: Number(c.increment_pct) || 0, planDate: c.plan_date,
          }));
          const progress: ProgressRow[] = (d.mdr_progress ?? []).map((p) => ({
            stage: p.stage, pct: p.pct, subIdx: p.sub_idx ?? 0,
            isDone: !!p.is_done, actualDate: p.actual_date,
          }));
          pSum += drawingMilestonePlannedPct(milestones, stage, ms.pct, asOf);
          aSum += actualPctUpTo(milestones, progress, stage, ms.pct, cells);
        }
        const n = matching.length;
        const plan = pSum / n, actual = aSum / n;
        row.cells.set(mkKey(stage, ms.pct, ms.planDate), {
          plan, actual, delta: actual - plan, drawingCount: n,
        });
      }
    }
    rows.push(row);
  }

  // 정렬: 건물(고정 순서) → discipline 표준 순서
  const BUILDING_ORDER = ["GEN", "SMP&CCM", "HSM", "CRM", "MAIN_OFFICE"];
  const DISC_ORDER = ["ARCH", "STR", "MECH", "ELEC", "FAFP", "CIVIL"];
  const bIdx = (b: string) => { const i = BUILDING_ORDER.indexOf(b); return i === -1 ? 99 : i; };
  const dIdx = (d: string) => { const i = DISC_ORDER.indexOf(d); return i === -1 ? 99 : i; };
  rows.sort((a, b) => {
    const bi = bIdx(a.building) - bIdx(b.building);
    if (bi !== 0) return bi;
    if (a.building !== b.building) return a.building.localeCompare(b.building);
    const di = dIdx(a.discipline) - dIdx(b.discipline);
    if (di !== 0) return di;
    return a.discipline.localeCompare(b.discipline);
  });

  const buildings = Array.from(new Set(rows.map((r) => r.building)));
  return { asOf, milestonesByStage, rows, buildings };
}

function sortMs(a: MonitorMilestoneKey, b: MonitorMilestoneKey): number {
  if (a.pct !== b.pct) return a.pct - b.pct;
  const ap = a.planDate ?? "";
  const bp = b.planDate ?? "";
  return ap.localeCompare(bp);
}

export async function computeMatrix(asOf: string): Promise<MonitorMatrix> {
  const drawings = await loadDrawings();
  return buildMatrix(drawings, asOf);
}

/** 전체 계산 결과를 snapshot 테이블에 upsert */
export async function saveSnapshot(matrix: MonitorMatrix): Promise<void> {
  const rows: any[] = [];
  for (const r of matrix.rows) {
    for (const stage of STAGES) {
      for (const ms of matrix.milestonesByStage[stage]) {
        const cell = r.cells.get(mkKey(stage, ms.pct, ms.planDate));
        if (!cell) continue;
        rows.push({
          as_of: matrix.asOf,
          building: r.building,
          discipline: r.discipline,
          stage,
          pct: ms.pct,
          label: ms.label ?? null,
          plan_date: ms.planDate,
          plan_pct: cell.plan,
          actual_pct: cell.actual,
          delta_pct: cell.delta,
          drawing_count: cell.drawingCount,
          drawing_count_sd: r.drawingCountSD,
          drawing_count_dd: r.drawingCountDD,
          drawing_count_cd: r.drawingCountCD,
          computed_at: new Date().toISOString(),
        });
      }
    }
  }
  if (!rows.length) return;
  // 기존 동일 (as_of, building, discipline) 삭제 후 insert (간단·안전)
  const groups = new Map<string, { as_of: string; building: string; discipline: string }>();
  for (const r of rows) {
    groups.set(`${r.as_of}|${r.building}|${r.discipline}`, { as_of: r.as_of, building: r.building, discipline: r.discipline });
  }
  for (const g of groups.values()) {
    await (supabase.from("mdr_milestone_snapshots" as never) as any)
      .delete()
      .eq("as_of", g.as_of)
      .eq("building", g.building)
      .eq("discipline", g.discipline);
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("mdr_milestone_snapshots" as never).insert(chunk as any);
    if (error) throw error;
  }
}

/** snapshot 테이블에서 최신 as_of 의 매트릭스 로드 (없으면 null). */
export async function loadLatestSnapshot(): Promise<MonitorMatrix | null> {
  const { data: maxData } = await supabase
    .from("mdr_milestone_snapshots" as never)
    .select("as_of")
    .order("as_of", { ascending: false })
    .limit(1);
  const latest = ((maxData as unknown) as { as_of: string }[])?.[0]?.as_of;
  if (!latest) return null;
  const { data, error } = await supabase
    .from("mdr_milestone_snapshots" as never)
    .select("as_of, building, discipline, stage, pct, label, plan_date, plan_pct, actual_pct, delta_pct, drawing_count, drawing_count_sd, drawing_count_dd, drawing_count_cd")
    .eq("as_of", latest);
  if (error) throw error;
  const list = ((data as unknown) as any[]) ?? [];
  if (list.length === 0) return null;

  const milestonesByStage: Record<MdrStage, MonitorMilestoneKey[]> = { SD: [], DD: [], CD: [] };
  const seen: Record<MdrStage, Set<string>> = { SD: new Set(), DD: new Set(), CD: new Set() };
  const rowMap = new Map<string, MonitorDiscRow>();
  for (const r of list) {
    const stage = r.stage as MdrStage;
    if (!STAGES.includes(stage)) continue;
    const k = mkKey(stage, r.pct, r.plan_date ?? null);
    if (!seen[stage].has(k)) {
      seen[stage].add(k);
      milestonesByStage[stage].push({ stage, pct: r.pct, planDate: r.plan_date ?? null, label: r.label ?? null });
    }
    const rk = `${r.building}||${r.discipline}`;
    const row: MonitorDiscRow = rowMap.get(rk) ?? {
      building: r.building, discipline: r.discipline,
      drawingCount: 0, drawingCountSD: 0, drawingCountDD: 0, drawingCountCD: 0,
      cells: new Map<string, MonitorCell>(),
    };
    row.cells.set(k, {
      plan: Number(r.plan_pct) || 0,
      actual: Number(r.actual_pct) || 0,
      delta: Number(r.delta_pct) || 0,
      drawingCount: Number(r.drawing_count) || 0,
    });
    row.drawingCount = Math.max(row.drawingCount, Number(r.drawing_count) || 0);
    row.drawingCountSD = Math.max(row.drawingCountSD, Number(r.drawing_count_sd) || 0);
    row.drawingCountDD = Math.max(row.drawingCountDD, Number(r.drawing_count_dd) || 0);
    row.drawingCountCD = Math.max(row.drawingCountCD, Number(r.drawing_count_cd) || 0);
    rowMap.set(rk, row);
  }

  // 라이브 카운트로 항상 보정 (snapshot 누락/오래된 값 무시)
  const live = await fetchDrawingCountsByGroup();
  for (const row of rowMap.values()) {
    const k = `${row.building}||${row.discipline}`;
    const c = live.get(k);
    if (c) {
      row.drawingCount = c.total;
      row.drawingCountSD = c.sd;
      row.drawingCountDD = c.dd;
      row.drawingCountCD = c.cd;
    }
  }

  for (const stage of STAGES) milestonesByStage[stage].sort(sortMs);
  return {
    asOf: latest,
    milestonesByStage,
    rows: Array.from(rowMap.values()),
    buildings: Array.from(new Set(Array.from(rowMap.values()).map((r) => r.building))),
  };
}
