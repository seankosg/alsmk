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
  mdr_milestones: { stage: StageCode; pct: number; plan_date: string | null }[] | null;
  mdr_progress: { stage: StageCode; pct: number; is_done: boolean }[] | null;
}

export interface StageCell {
  plan: number;     // plan_date 존재 도면 수
  actual: number;   // 100% 도달 도면 수
  progress: number; // 0~1, 도면별 누적 진척의 평균
}

export interface DiscCell {
  building: string;
  discipline: string;
  drawingCount: number;
  sd: StageCell;
  dd: StageCell;
  cd: StageCell;
  discProgress: number;     // SD×SD_WF + DD×DD_WF + CD×CD_WF (0~1)
}

export interface BlockSummary {
  building: string;
  drawingCount: number;
  cells: DiscCell[];                          // discipline별 셀
  blockProgress: number;                      // Σ(DiscProgress × DiscWF) (0~1)
  buildingWf: number;                         // 0이면 합산 제외
  contributesToOverall: boolean;
  totals: { sd: StageCell; dd: StageCell; cd: StageCell };
}

export interface MdrSummary {
  blocks: BlockSummary[];
  overallProgress: number;            // Σ(blockProgress × buildingWf) (0~1)
  overallDrawingCount: number;        // 합산 대상 도면 수
  overallActualCount: number;         // 합산 대상 중 모든 stage 100% 도달 도면 수
  wf: MdrWfBundle;
}

function emptyCell(): StageCell {
  return { plan: 0, actual: 0, progress: 0 };
}

function maxPct(arr: { stage: StageCode; pct: number; is_done?: boolean }[] | null, stage: StageCode): number {
  if (!arr) return 0;
  let m = 0;
  for (const r of arr) {
    if (r.stage !== stage) continue;
    if (r.is_done === false) continue; // progress 행은 is_done=true만 카운트
    if (r.pct > m) m = r.pct;
  }
  return m;
}

function hasPlanForStage(milestones: { stage: StageCode; pct: number; plan_date: string | null }[] | null, stage: StageCode): boolean {
  if (!milestones) return false;
  return milestones.some((m) => m.stage === stage && (m.plan_date || m.pct > 0));
}

function computeBlock(building: string, drawings: RawDrawing[], wf: MdrWfBundle): BlockSummary {
  // discipline 그룹핑
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
    const sums: Record<StageCode, number> = { SD: 0, DD: 0, CD: 0 };
    for (const dr of list) {
      for (const st of STAGES) {
        const planned = hasPlanForStage(dr.mdr_milestones, st);
        if (planned) cell[stKey(st)].plan += 1;
        const pct = maxPct(dr.mdr_progress, st);
        const ratio = Math.max(0, Math.min(100, pct)) / 100;
        sums[st] += ratio;
        if (pct >= 100) cell[stKey(st)].actual += 1;
      }
    }
    for (const st of STAGES) {
      const plan = cell[stKey(st)].plan;
      cell[stKey(st)].progress = plan > 0 ? sums[st] / plan : 0;
      // block totals (단순 합산)
      totals[stKey(st)].plan += cell[stKey(st)].plan;
      totals[stKey(st)].actual += cell[stKey(st)].actual;
      totals[stKey(st)].progress += sums[st]; // 임시: 합산 평균 위해 나중에 나눔
    }
    // Discipline progress = SD×WF + DD×WF + CD×WF (해당 stage에 plan이 있을 때만 가중치 사용)
    let dpNum = 0, dpDen = 0;
    for (const st of STAGES) {
      if (cell[stKey(st)].plan > 0) {
        dpNum += cell[stKey(st)].progress * wf.stage[st];
        dpDen += wf.stage[st];
      }
    }
    cell.discProgress = dpDen > 0 ? dpNum / dpDen : 0;
    cells.push(cell);
  }

  // totals.progress 평균화
  const blockDwgCount = drawings.length;
  for (const st of STAGES) {
    const plan = totals[stKey(st)].plan;
    totals[stKey(st)].progress = plan > 0 ? totals[stKey(st)].progress / plan : 0;
  }

  // Block progress = Σ(discProgress × discWF) / Σ(discWF where 도면 존재)
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

  // 안정적인 표시 순서
  const ORDER = ["ARCH", "STR", "MECH", "ELEC", "FAFP", "CIVIL"];
  cells.sort((a, b) => {
    const ai = ORDER.indexOf(a.discipline);
    const bi = ORDER.indexOf(b.discipline);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return {
    building,
    drawingCount: blockDwgCount,
    cells,
    blockProgress,
    buildingWf,
    contributesToOverall: buildingWf > 0,
    totals,
  };
}

function stKey(s: StageCode): "sd" | "dd" | "cd" {
  return s.toLowerCase() as "sd" | "dd" | "cd";
}

async function fetchSummary(): Promise<MdrSummary> {
  const wf = await loadMdrWeights();

  // PostgREST 기본 1000행 제한 회피: 1000행 단위 페이지네이션으로 전체 로드
  const PAGE = 1000;
  const rows: RawDrawing[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("id, building_code, discipline, out_of_scope, mdr_milestones(stage,pct,plan_date), mdr_progress(stage,pct,is_done)")
      .eq("out_of_scope", false)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = ((data as unknown) as RawDrawing[]) ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }


  const byBuilding = new Map<string, RawDrawing[]>();
  for (const d of rows) {
    if (!d.building_code) continue;
    const arr = byBuilding.get(d.building_code) ?? [];
    arr.push(d);
    byBuilding.set(d.building_code, arr);
  }

  const blocks: BlockSummary[] = [];
  for (const [building, list] of byBuilding.entries()) {
    blocks.push(computeBlock(building, list, wf));
  }

  // Building 순서: WF 큰 순 → 이름순
  blocks.sort((a, b) => (b.buildingWf - a.buildingWf) || a.building.localeCompare(b.building));

  let overallProgress = 0;
  let overallDwg = 0;
  let overallActual = 0;
  for (const b of blocks) {
    if (b.contributesToOverall) {
      overallProgress += b.blockProgress * b.buildingWf;
      overallDwg += b.drawingCount;
      // 도면 단위 actual: 모든 plan된 stage에서 100% 도달
      // 단순화: CD가 100%인 도면 수만 카운트 (CD가 최종 단계)
      overallActual += b.totals.cd.actual;
    }
  }

  return { blocks, overallProgress, overallDrawingCount: overallDwg, overallActualCount: overallActual, wf };
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

