/**
 * Design Progress Status (설계진도율) — Block × Discipline 행, Stage × 마일스톤 × {P,A,Δ} 컬럼.
 * 도면별 cell-level 계획(`drawingMilestonePlannedPct`) 과 실적(`actualPctUpTo`) 을
 * 도면 가중평균(mdr_weights 없는 경우 단순평균)으로 집계.
 *
 * 캐시: `mdr_milestone_snapshots` 테이블에 (as_of, building, discipline, stage, pct) UNIQUE upsert.
 *   - 일반 로드: 최신 snapshot 그대로 표시 + 기준일 이후 가장 가까운 1개 마일스톤만 재계산.
 *   - `recomputeAll: true`: 모든 마일스톤 재계산 후 upsert.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  drawingCellPlannedPct,
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
  /** 셀(sub_idx) 단위 컬럼. 그룹 단위 fallback 시 0. */
  subIdx: number;
  /** 셀별 increment(%) — 도면별로 다를 수 있어 표시용·검증용. */
  incrementPct: number;
  planDate: string | null;
  label?: string | null;
}

export interface MonitorCell {
  plan: number;             // 0~100
  actual: number | null;    // 0~100, null = 기준일 미도래
  delta: number | null;     // actual - plan, null = A 가 null 일 때
  drawingCount: number;
  /** 동일 단계 내 이전 마일스톤 A 대비 같거나 감소 → 역진행/정체 경고 */
  warn?: boolean;
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
  dd_weight: number | null;
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
      .select("id, building_code, discipline, out_of_scope, in_scope_sd, in_scope_dd, in_scope_cd, dd_weight, mdr_milestones(stage,pct,plan_date,increment_pct), mdr_milestone_cells(stage,pct,sub_idx,increment_pct,plan_date,label), mdr_progress(stage,pct,sub_idx,is_done,actual_date)")
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
      stageW: { SD: { plan: 0, actual: 0, delta: 0 }, DD: { plan: 0, actual: 0, delta: 0 }, CD: { plan: 0, actual: 0, delta: 0 } },
    };
    // WF(Summary 산식) 단계별 누적 — 도면 평균
    const stagePlanSum: Record<MdrStage, number> = { SD: 0, DD: 0, CD: 0 };
    const stageActualSum: Record<MdrStage, number> = { SD: 0, DD: 0, CD: 0 };
    const stageN: Record<MdrStage, number> = { SD: 0, DD: 0, CD: 0 };

    // 각 마일스톤 key 별로 P/A 평균 + Summary 산식(단계 step) 누적
    for (const d of g.drawings) {
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
      for (const stage of STAGES) {
        if (!isInScope(d, stage)) continue;
        stageN[stage] += 1;
        // SD 는 Raw/Summary 와 일치시키기 위해 항상 100% 계획.
        // DD/CD 는 Summary planAtDate: plan_date ≤ asOf 의 최대 pct.
        let planPct = 0;
        if (stage === "SD") {
          planPct = 100;
        } else {
          for (const m of d.mdr_milestones ?? []) {
            if (m.stage !== stage || !m.plan_date) continue;
            if (m.plan_date > asOf) continue;
            if (m.pct > planPct) planPct = m.pct;
          }
        }
        // Summary actualAtDate: actual_date ≤ asOf & is_done 의 cell increment 합
        let actualPct = 0;
        if (d.mdr_milestone_cells && d.mdr_milestone_cells.length) {
          for (const cc of d.mdr_milestone_cells) {
            if (cc.stage !== stage) continue;
            const matched = (d.mdr_progress ?? []).find((p) =>
              p.stage === stage && p.pct === cc.pct && (p.sub_idx ?? 0) === cc.sub_idx
              && p.is_done && (!p.actual_date || p.actual_date <= asOf),
            );
            if (matched) actualPct += Number(cc.increment_pct) || 0;
          }
        } else {
          // 폴백: 그룹 단위
          let m = 0;
          for (const p of d.mdr_progress ?? []) {
            if (p.stage !== stage || !p.is_done) continue;
            if (p.actual_date && p.actual_date > asOf) continue;
            if (p.pct > m) m = p.pct;
          }
          actualPct = m;
        }
        stagePlanSum[stage] += planPct;
        stageActualSum[stage] += actualPct;
      }
    }
    // === DD: 도면별 dd_weight 가 모두 있으면 엑셀 'DD CURRENT STATUS' 방식으로 재집계 ===
    // 합계 = Σ(dd_weight × 100 × DD-완료여부). 그룹 내 모든 in-scope DD 도면이 weight 보유 시에만 적용.
    const ddDrawings = g.drawings.filter((d) => isInScope(d, "DD"));
    const allHaveDdW = ddDrawings.length > 0 && ddDrawings.every((d) => d.dd_weight != null);
    let ddActualWeighted: number | null = null;
    if (allHaveDdW) {
      let sum = 0;
      for (const d of ddDrawings) {
        // 셀 단위 DD 실적 100% 도달 여부 (milestone cells 기반)
        let cellSum = 0;
        if (d.mdr_milestone_cells && d.mdr_milestone_cells.length) {
          for (const cc of d.mdr_milestone_cells) {
            if (cc.stage !== "DD") continue;
            const matched = (d.mdr_progress ?? []).find((p) =>
              p.stage === "DD" && p.pct === cc.pct && (p.sub_idx ?? 0) === cc.sub_idx
              && p.is_done && (!p.actual_date || p.actual_date <= asOf),
            );
            if (matched) cellSum += Number(cc.increment_pct) || 0;
          }
        }
        const fullyDone = cellSum >= 99.99;
        if (fullyDone) sum += Number(d.dd_weight) * 100;
      }
      ddActualWeighted = sum;
    }

    for (const stage of STAGES) {
      const n = stageN[stage];
      const plan = n > 0 ? stagePlanSum[stage] / n : 0;
      let actual = n > 0 ? stageActualSum[stage] / n : 0;
      if (stage === "DD" && ddActualWeighted !== null) {
        actual = ddActualWeighted;
      }
      row.stageW[stage] = { plan, actual, delta: actual - plan };
    }

    // 기존 per-milestone 셀 P/A (interpolated, 도면 단순평균) — 유지
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
        const plan = pSum / n;
        // 기준일 미도래(마일스톤 planDate > asOf) → A=Null, Δ=Null
        const future = !!(ms.planDate && ms.planDate > asOf);
        const actual: number | null = future ? null : aSum / n;
        const delta: number | null = actual === null ? null : actual - plan;
        row.cells.set(mkKey(stage, ms.pct, ms.planDate), {
          plan, actual, delta, drawingCount: n,
        });
      }
    }
    rows.push(row);
  }

  // 역진행/정체 경고 플래그 — 행별, 단계별 마일스톤 순서 기준
  for (const row of rows) {
    for (const stage of STAGES) {
      let prevA: number | null = null;
      for (const ms of milestonesByStage[stage]) {
        const cell = row.cells.get(mkKey(stage, ms.pct, ms.planDate));
        if (!cell) continue;
        const currA = cell.actual;
        if (prevA !== null && prevA > 0 && currA !== null && currA <= prevA) {
          cell.warn = true;
        }
        if (currA !== null) prevA = currA;
      }
    }
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

/** 전체 계산 결과를 snapshot 테이블에 저장 (as_of 일괄 DELETE → 청크 INSERT) */
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
          stage_plan_pct: r.stageW[stage]?.plan ?? null,
          stage_actual_pct: r.stageW[stage]?.actual ?? null,
          computed_at: new Date().toISOString(),
        });
      }
    }
  }
  if (!rows.length) return;
  // 동일 as_of 의 기존 스냅샷 일괄 삭제 (DELETE 라운드트립 N → 1)
  {
    const { error } = await (supabase.from("mdr_milestone_snapshots" as never) as any)
      .delete()
      .eq("as_of", matrix.asOf);
    if (error) throw error;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("mdr_milestone_snapshots" as never).insert(chunk as any);
    if (error) throw error;
  }
}

/** 최신 스냅샷의 메타데이터(기준일·계산시각) — 가벼운 1행 조회. */
export async function loadLatestSnapshotMeta(): Promise<{ asOf: string; computedAt: string | null } | null> {
  const { data, error } = await supabase
    .from("mdr_milestone_snapshots" as never)
    .select("as_of, computed_at")
    .order("as_of", { ascending: false })
    .order("computed_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = ((data as unknown) as { as_of: string; computed_at: string | null }[])?.[0];
  if (!row) return null;
  return { asOf: row.as_of, computedAt: row.computed_at ?? null };
}

/** 최신 MDR 임포트(성공) 시각 — 스냅샷이 임포트보다 오래되었는지 판단용. */
export async function loadLatestImportAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("mdr_import_logs" as never)
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const row = ((data as unknown) as { created_at: string | null }[])?.[0];
  return row?.created_at ?? null;
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
    .select("as_of, building, discipline, stage, pct, label, plan_date, plan_pct, actual_pct, delta_pct, drawing_count, drawing_count_sd, drawing_count_dd, drawing_count_cd, stage_plan_pct, stage_actual_pct")
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
      stageW: { SD: { plan: 0, actual: 0, delta: 0 }, DD: { plan: 0, actual: 0, delta: 0 }, CD: { plan: 0, actual: 0, delta: 0 } },
    };
    row.cells.set(k, {
      plan: Number(r.plan_pct) || 0,
      actual: r.actual_pct == null ? null : Number(r.actual_pct),
      delta: r.delta_pct == null ? null : Number(r.delta_pct),
      drawingCount: Number(r.drawing_count) || 0,
    });
    if (r.stage_plan_pct != null || r.stage_actual_pct != null) {
      const p = Number(r.stage_plan_pct) || 0;
      const a = Number(r.stage_actual_pct) || 0;
      row.stageW[stage] = { plan: p, actual: a, delta: a - p };
    }
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

  // 미도래(planDate > asOf) 셀 A/Δ → null 정규화 + 역진행/정체 warn 재계산
  for (const row of rowMap.values()) {
    for (const stage of STAGES) {
      let prevA: number | null = null;
      for (const ms of milestonesByStage[stage]) {
        const cell = row.cells.get(mkKey(stage, ms.pct, ms.planDate));
        if (!cell) continue;
        if (ms.planDate && ms.planDate > latest) {
          cell.actual = null;
          cell.delta = null;
        }
        cell.warn = false;
        const currA = cell.actual;
        if (prevA !== null && prevA > 0 && currA !== null && currA <= prevA) {
          cell.warn = true;
        }
        if (currA !== null) prevA = currA;
      }
    }
  }

  return {
    asOf: latest,
    milestonesByStage,
    rows: Array.from(rowMap.values()),
    buildings: Array.from(new Set(Array.from(rowMap.values()).map((r) => r.building))),
  };
}
