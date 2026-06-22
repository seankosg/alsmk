/**
 * Raw Data(mdr_drawings + mdr_milestones + mdr_progress) → SUMMARY 매트릭스/KPI 계산.
 * SUMMARY 엑셀(00_SUMMARY_MDR_progress)의 Weekly progress 시트 표현을 앱이 직접 산정.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  loadMdrWeights,
  normalizeDiscipline,
  type MdrWfBundle,
  type StageCode,
} from "./weights";

const STAGES: StageCode[] = ["SD", "DD", "CD"];

interface RawDrawing {
  id: string;
  building_code: string;
  discipline: string | null;
  out_of_scope: boolean;
  in_scope_sd: boolean | null;
  in_scope_dd: boolean | null;
  in_scope_cd: boolean | null;
  mdr_milestones: { stage: StageCode; pct: number; plan_date: string | null }[] | null;
  mdr_progress: { stage: StageCode; pct: number; is_done: boolean; actual_date: string | null }[] | null;
}

/**
 * Stage 셀 — 조회일(D) 기준 EV 방식.
 *  plan:    해당 셀 도면들의 계획 진도율 평균 (0~1)
 *  actual:  해당 셀 도면들의 실적 진도율 평균 (0~1)
 *  progress: 호환용 — actual과 동일 (% 컬럼 표시는 후속 정의)
 *  drawingCount: 해당 stage에 마일스톤(계획)이 존재하는 도면 수
 */
export interface StageCell {
  plan: number;
  actual: number;
  progress: number;
  drawingCount: number;
}

export interface DiscCell {
  building: string;
  discipline: string;
  drawingCount: number;
  sd: StageCell;
  dd: StageCell;
  cd: StageCell;
  discProgress: number;
}

export interface BlockSummary {
  building: string;
  drawingCount: number;
  cells: DiscCell[];
  blockProgress: number;
  buildingWf: number;
  contributesToOverall: boolean;
  totals: { sd: StageCell; dd: StageCell; cd: StageCell };
  inMaster: boolean;
  hasDrawings: boolean;
  sortOrder: number;
}

export interface MdrSummary {
  blocks: BlockSummary[];
  overallProgress: number;
  overallDrawingCount: number;
  overallActualCount: number;
  wf: MdrWfBundle;
  dataDate: string; // YYYY-MM-DD
}

function emptyCell(): StageCell {
  return { plan: 0, actual: 0, progress: 0, drawingCount: 0 };
}

/** 조회일 D 이전(포함) 마일스톤 중 최대 pct → 계획 진도율(0~100). */
function planAtDate(
  milestones: { stage: StageCode; pct: number; plan_date: string | null }[] | null,
  stage: StageCode,
  D: string,
): number {
  if (!milestones) return 0;
  let m = 0;
  for (const r of milestones) {
    if (r.stage !== stage) continue;
    if (!r.plan_date) continue;
    if (r.plan_date > D) continue;
    if (r.pct > m) m = r.pct;
  }
  return m;
}

/** is_done=true & actual_date ≤ D인 progress 중 최대 pct → 실적 진도율(0~100). */
function actualAtDate(
  progress: { stage: StageCode; pct: number; is_done: boolean; actual_date: string | null }[] | null,
  stage: StageCode,
  D: string,
): number {
  if (!progress) return 0;
  let m = 0;
  for (const r of progress) {
    if (r.stage !== stage) continue;
    if (!r.is_done) continue;
    if (r.actual_date && r.actual_date > D) continue;
    if (r.pct > m) m = r.pct;
  }
  return m;
}

function isInScope(d: RawDrawing, stage: StageCode): boolean {
  // in_scope_* 가 명시적으로 채워진 경우(true/false) 그것이 권위.
  // 모두 null 인 레거시 행이면 마일스톤·plan_date 로 폴백 판정.
  const explicit =
    d.in_scope_sd !== null || d.in_scope_dd !== null || d.in_scope_cd !== null;
  if (explicit) {
    if (stage === "SD") return !!d.in_scope_sd;
    if (stage === "DD") return !!d.in_scope_dd;
    return !!d.in_scope_cd;
  }
  // 폴백: 마일스톤이 있으면 그 단계는 in-scope 로 간주
  if (!d.mdr_milestones) return false;
  return d.mdr_milestones.some((m) => m.stage === stage && (m.plan_date || m.pct > 0));
}

function computeBlock(
  building: string,
  drawings: RawDrawing[],
  wf: MdrWfBundle,
  dataDate: string,
  meta: { inMaster: boolean; sortOrder: number },
): BlockSummary {
  const byDisc = new Map<string, RawDrawing[]>();
  for (const d of drawings) {
    const key = normalizeDiscipline(d.discipline);
    const arr = byDisc.get(key) ?? [];
    arr.push(d);
    byDisc.set(key, arr);
  }

  const cells: DiscCell[] = [];
  const totals = { sd: emptyCell(), dd: emptyCell(), cd: emptyCell() };

  for (const [disc, list] of byDisc.entries()) {
    const cell: DiscCell = {
      building, discipline: disc, drawingCount: list.length,
      sd: emptyCell(), dd: emptyCell(), cd: emptyCell(), discProgress: 0,
    };
    // stage별 누적
    const planSum: Record<StageCode, number> = { SD: 0, DD: 0, CD: 0 };
    const actualSum: Record<StageCode, number> = { SD: 0, DD: 0, CD: 0 };

    for (const dr of list) {
      for (const st of STAGES) {
        if (!isInScope(dr, st)) continue;
        cell[stKey(st)].drawingCount += 1;
        planSum[st] += planAtDate(dr.mdr_milestones, st, dataDate) / 100;
        actualSum[st] += actualAtDate(dr.mdr_progress, st, dataDate) / 100;
      }
    }

    for (const st of STAGES) {
      const n = cell[stKey(st)].drawingCount;
      cell[stKey(st)].plan = n > 0 ? planSum[st] / n : 0;
      cell[stKey(st)].actual = n > 0 ? actualSum[st] / n : 0;
      cell[stKey(st)].progress = cell[stKey(st)].actual;
      // 블록 합계 누적
      totals[stKey(st)].drawingCount += n;
      totals[stKey(st)].plan += planSum[st];   // 합산 후 나눔
      totals[stKey(st)].actual += actualSum[st];
    }

    // Discipline progress = stage WF 가중평균 (실적 기준)
    let dpNum = 0, dpDen = 0;
    for (const st of STAGES) {
      if (cell[stKey(st)].drawingCount > 0) {
        dpNum += cell[stKey(st)].actual * wf.stage[st];
        dpDen += wf.stage[st];
      }
    }
    cell.discProgress = dpDen > 0 ? dpNum / dpDen : 0;
    cells.push(cell);
  }

  // 블록 totals 평균화
  for (const st of STAGES) {
    const n = totals[stKey(st)].drawingCount;
    totals[stKey(st)].plan = n > 0 ? totals[stKey(st)].plan / n : 0;
    totals[stKey(st)].actual = n > 0 ? totals[stKey(st)].actual / n : 0;
    totals[stKey(st)].progress = totals[stKey(st)].actual;
  }

  let bpNum = 0, bpDen = 0;
  for (const c of cells) {
    const w = wf.discipline[c.discipline] ?? 0;
    if (c.drawingCount > 0 && w > 0) {
      bpNum += c.discProgress * w;
      bpDen += w;
    }
  }
  const blockProgress = bpDen > 0 ? bpNum / bpDen : 0;
  const buildingWf = wf.building[building] ?? 0;

  const ORDER = ["ARCH", "STR", "MECH", "ELEC", "FAFP", "CIVIL"];
  cells.sort((a, b) => {
    const ai = ORDER.indexOf(a.discipline);
    const bi = ORDER.indexOf(b.discipline);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // 도면 0건이어도 행을 1줄 표시하기 위한 placeholder cell
  if (cells.length === 0) {
    cells.push({
      building,
      discipline: "—",
      drawingCount: 0,
      sd: emptyCell(),
      dd: emptyCell(),
      cd: emptyCell(),
      discProgress: 0,
    });
  }

  return {
    building,
    drawingCount: drawings.length,
    cells,
    blockProgress,
    buildingWf,
    contributesToOverall: buildingWf > 0 && drawings.length > 0,
    totals,
    inMaster: meta.inMaster,
    hasDrawings: drawings.length > 0,
    sortOrder: meta.sortOrder,
  };
}


function stKey(s: StageCode): "sd" | "dd" | "cd" {
  return s.toLowerCase() as "sd" | "dd" | "cd";
}

async function fetchSummary(): Promise<MdrSummary> {
  const [wf, mastersRes] = await Promise.all([
    loadMdrWeights(),
    supabase.from("mdr_buildings" as never).select("code, sort_order"),
  ]);
  if (mastersRes.error) throw mastersRes.error;
  const masters = ((mastersRes.data as unknown) as { code: string; sort_order: number | null }[]) ?? [];
  const masterMeta = new Map<string, { inMaster: true; sortOrder: number }>();
  for (const m of masters) {
    if (!m.code) continue;
    masterMeta.set(m.code, { inMaster: true, sortOrder: m.sort_order ?? 0 });
  }

  // PostgREST 기본 1000행 제한 회피: 1000행 단위 페이지네이션으로 전체 로드
  const PAGE = 1000;
  const rows: RawDrawing[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("id, building_code, discipline, out_of_scope, mdr_milestones(stage,pct,plan_date), mdr_progress(stage,pct,is_done,actual_date)")
      .eq("out_of_scope", false)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = ((data as unknown) as RawDrawing[]) ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }

  const dataDate = new Date().toISOString().slice(0, 10);

  const byBuilding = new Map<string, RawDrawing[]>();
  for (const d of rows) {
    if (!d.building_code) continue;
    const arr = byBuilding.get(d.building_code) ?? [];
    arr.push(d);
    byBuilding.set(d.building_code, arr);
  }

  // 합집합: 마스터 등록 건물 ∪ 도면에 등장한 건물
  const allKeys = new Set<string>([...masterMeta.keys(), ...byBuilding.keys()]);

  const blocks: BlockSummary[] = [];
  for (const building of allKeys) {
    const list = byBuilding.get(building) ?? [];
    const meta = masterMeta.get(building) ?? { inMaster: false, sortOrder: 9999 };
    blocks.push(computeBlock(building, list, wf, dataDate, meta));
  }

  blocks.sort((a, b) => {
    // 마스터 미등록 건물은 항상 맨 아래
    if (a.inMaster !== b.inMaster) return a.inMaster ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (b.buildingWf !== a.buildingWf) return b.buildingWf - a.buildingWf;
    return a.building.localeCompare(b.building);
  });

  let overallProgress = 0;
  let overallDwg = 0;
  let overallActual = 0;
  for (const b of blocks) {
    if (b.contributesToOverall) {
      overallProgress += b.blockProgress * b.buildingWf;
      overallDwg += b.drawingCount;
      // CD actual %를 도면 수로 환산
      overallActual += Math.round(b.totals.cd.actual * b.totals.cd.drawingCount);
    }
  }

  return { blocks, overallProgress, overallDrawingCount: overallDwg, overallActualCount: overallActual, wf, dataDate };
}

export function useMdrSummary() {
  return useQuery({
    queryKey: ["mdr_summary_engine"],
    queryFn: fetchSummary,
    staleTime: 30_000,
  });
}

// ===================== 보조 셀렉터 =====================

export interface DisciplineRollup {
  discipline: string;
  drawingCount: number;
  weightedProgress: number;
  disciplineWf: number;
}

/** 분야별 진척률 — 합산 대상 블록만, building WF로 가중 평균. */
export function selectDisciplineRollup(summary: MdrSummary): DisciplineRollup[] {
  const map = new Map<string, { num: number; den: number; dwg: number }>();
  for (const b of summary.blocks) {
    if (!b.contributesToOverall) continue;
    for (const c of b.cells) {
      const cur = map.get(c.discipline) ?? { num: 0, den: 0, dwg: 0 };
      cur.num += c.discProgress * b.buildingWf;
      cur.den += b.buildingWf;
      cur.dwg += c.drawingCount;
      map.set(c.discipline, cur);
    }
  }
  const ORDER = ["ARCH", "STR", "MECH", "ELEC", "FAFP", "CIVIL"];
  return Array.from(map.entries())
    .map(([discipline, v]) => ({
      discipline,
      drawingCount: v.dwg,
      weightedProgress: v.den > 0 ? v.num / v.den : 0,
      disciplineWf: summary.wf.discipline[discipline] ?? 0,
    }))
    .sort((a, b) => {
      const ai = ORDER.indexOf(a.discipline);
      const bi = ORDER.indexOf(b.discipline);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export interface StageRollup {
  stage: StageCode;
  plan: number;
  actual: number;
  rate: number;
}

/** Stage별 Plan/Actual 합계 — 합산 대상 블록만. */
export function selectStageRollup(summary: MdrSummary): StageRollup[] {
  const acc: Record<StageCode, { plan: number; actual: number }> = {
    SD: { plan: 0, actual: 0 },
    DD: { plan: 0, actual: 0 },
    CD: { plan: 0, actual: 0 },
  };
  for (const b of summary.blocks) {
    if (!b.contributesToOverall) continue;
    for (const st of STAGES) {
      acc[st].plan += b.totals[stKey(st)].plan;
      acc[st].actual += b.totals[stKey(st)].actual;
    }
  }
  return STAGES.map((s) => ({
    stage: s,
    plan: acc[s].plan,
    actual: acc[s].actual,
    rate: acc[s].plan > 0 ? acc[s].actual / acc[s].plan : 0,
  }));
}

export interface OverdueDrawing {
  id: string;
  drawing_no: string | null;
  title: string | null;
  building_code: string | null;
  discipline: string | null;
  stage: StageCode;
  plan_date: string;
  pct: number;
  daysLate: number;
}

/** plan_date 경과 & 미완(pct<100) 마일스톤 목록. */
export function useMdrOverdueDrawings(limit = 50) {
  return useQuery({
    queryKey: ["mdr_overdue_drawings", limit],
    queryFn: async (): Promise<OverdueDrawing[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("mdr_drawings" as never)
        .select("id, drawing_no, title, building_code, discipline, out_of_scope, mdr_milestones(stage,pct,plan_date)")
        .eq("out_of_scope", false);
      if (error) throw error;
      const rows = ((data as unknown) as (RawDrawing & { drawing_no: string | null; title: string | null })[]) ?? [];
      const out: OverdueDrawing[] = [];
      for (const r of rows) {
        for (const m of r.mdr_milestones ?? []) {
          if (!m.plan_date) continue;
          if (m.plan_date >= today) continue;
          if ((m.pct ?? 0) >= 100) continue;
          const days = Math.floor(
            (new Date(today).getTime() - new Date(m.plan_date).getTime()) / 86400000
          );
          out.push({
            id: r.id,
            drawing_no: r.drawing_no,
            title: r.title,
            building_code: r.building_code,
            discipline: r.discipline,
            stage: m.stage,
            plan_date: m.plan_date,
            pct: m.pct ?? 0,
            daysLate: days,
          });
        }
      }
      out.sort((a, b) => b.daysLate - a.daysLate);
      return out.slice(0, limit);
    },
    staleTime: 30_000,
  });
}

