/**
 * MDR Progress Icon — milestone별 Pip 상태 분류
 * SHAW PROJECT CMS의 StageProgress 디자인을 차용
 */
import type { MdrStage } from "./parser";

export type MdrMilestoneState = "done" | "wip" | "delay" | "planned" | "empty";

export interface MdrPipCell {
  stage: MdrStage;
  pct: number;
  label: string; // "SD", "DD30", "DD60", ...
  state: MdrMilestoneState;
  planDate: string | null;
  actualDate: string | null;
}

export interface MdrProgressIconCells {
  sd: MdrPipCell;
  dd: MdrPipCell[];
  cd: MdrPipCell[];
}

export const DD_PIP_PCTS = [30, 60, 90, 100] as const;
export const CD_PIP_PCTS = [30, 60, 100] as const;

export const MDR_PIP_GLYPH: Record<MdrMilestoneState, string> = {
  done: "●",
  wip: "◐",
  delay: "⊘",
  planned: "○",
  empty: "·",
};

export const MDR_STATE_LABEL: Record<MdrMilestoneState, string> = {
  done: "Done",
  wip: "WIP",
  delay: "Delay",
  planned: "Planned",
  empty: "—",
};

/** Tailwind semantic 토큰 기반 색상 (다크/라이트 호환) */
export const MDR_PIP_CLASS: Record<MdrMilestoneState, string> = {
  done: "bg-success text-success-foreground border-success",
  wip: "bg-amber-400 text-amber-950 border-amber-500",
  delay: "bg-destructive text-destructive-foreground border-destructive",
  planned: "bg-transparent text-muted-foreground border-border",
  empty: "bg-transparent text-muted-foreground/40 border-border/40",
};

interface MsRow { stage: MdrStage; pct: number; plan_date: string | null; increment_pct?: number | string | null }
interface PgRow { stage: MdrStage; pct: number; is_done: boolean; actual_date: string | null; sub_idx?: number | null }
interface CellRow { stage: MdrStage; pct: number; subIdx: number; incrementPct: number }

function classify(
  stage: MdrStage,
  pct: number,
  ms: MsRow | undefined,
  pg: PgRow | undefined,
  prevDone: boolean,
  asOf: string,
  cellsDone?: boolean, // 셀 합 기반 done 판정
): MdrMilestoneState {
  if (!ms) return "empty";
  if (cellsDone) return "done";
  if (pg?.is_done) return "done";
  if (ms.plan_date && ms.plan_date < asOf) return "delay";
  if (prevDone) return "wip";
  return "planned";
}

/**
 * SD는 항상 단일 done Pip (SD100). DD/CD는 정의된 마일스톤 기준.
 * scope 가 주어지고 그 단계가 false 면 해당 단계는 "empty" 상태로 비활성 표시.
 */
export function buildMdrProgressIconCells(
  milestones: MsRow[],
  progress: PgRow[],
  asOf: string,
  scope?: { sd: boolean; dd: boolean; cd: boolean },
  cells?: CellRow[],
): MdrProgressIconCells {
  const find = (stage: MdrStage, pct: number) => ({
    ms: milestones.find((m) => m.stage === stage && m.pct === pct),
    pg: progress.find((p) => p.stage === stage && p.pct === pct && (p.sub_idx ?? 0) === 0),
    pgs: progress.filter((p) => p.stage === stage && p.pct === pct),
  });

  const sc = scope ?? { sd: true, dd: true, cd: true };

  // 셀 합 ≥ 그룹 합 일 때 done 판정
  const groupCellsDone = (stage: MdrStage, pct: number): boolean => {
    if (!cells || !cells.length) return false;
    const groupCells = cells.filter((c) => c.stage === stage && c.pct === pct);
    if (!groupCells.length) return false;
    let sum = 0;
    let target = 0;
    for (const cc of groupCells) {
      target += cc.incrementPct;
      const matched = progress.find((p) =>
        p.stage === stage && p.pct === pct && (p.sub_idx ?? 0) === cc.subIdx && p.is_done,
      );
      if (matched) sum += cc.incrementPct;
    }
    return target > 0 && sum + 1e-6 >= target;
  };

  // SD: 100만, scope.sd 인 경우에만 done
  const sdFind = find("SD", 100);
  const sd: MdrPipCell = {
    stage: "SD",
    pct: 100,
    label: "SD",
    state: sc.sd ? "done" : "empty",
    planDate: sdFind.ms?.plan_date ?? null,
    actualDate: sdFind.pg?.actual_date ?? null,
  };

  const buildSeq = (stage: MdrStage, pcts: readonly number[], initialPrevDone: boolean): MdrPipCell[] => {
    let prevDone = initialPrevDone;
    return pcts.map((p) => {
      const { ms, pg, pgs } = find(stage, p);
      const cellsDone = groupCellsDone(stage, p);
      const state = classify(stage, p, ms, pg, prevDone, asOf, cellsDone);
      prevDone = state === "done";
      // actualDate: 셀 단위 완료시 가장 늦은 actual_date
      let actualDate: string | null = pg?.actual_date ?? null;
      if (cellsDone) {
        for (const pp of pgs) {
          if (pp.is_done && pp.actual_date && (!actualDate || pp.actual_date > actualDate)) {
            actualDate = pp.actual_date;
          }
        }
      }
      return {
        stage,
        pct: p,
        label: `${stage}${p}`,
        state,
        planDate: ms?.plan_date ?? null,
        actualDate,
      };
    });
  };

  const buildEmpty = (stage: MdrStage, pcts: readonly number[]): MdrPipCell[] =>
    pcts.map((p) => ({
      stage, pct: p, label: `${stage}${p}`,
      state: "empty" as MdrMilestoneState,
      planDate: null, actualDate: null,
    }));

  const dd = sc.dd ? buildSeq("DD", DD_PIP_PCTS, sc.sd) : buildEmpty("DD", DD_PIP_PCTS);
  const dd100Done = sc.dd && dd[dd.length - 1]?.state === "done";
  const cd = sc.cd ? buildSeq("CD", CD_PIP_PCTS, dd100Done) : buildEmpty("CD", CD_PIP_PCTS);

  return { sd, dd, cd };
}

const PRIORITY: Record<MdrMilestoneState, number> = {
  delay: 5, wip: 4, planned: 3, done: 2, empty: 1,
};

export function summarizeGroupState(cells: MdrPipCell[]): MdrMilestoneState {
  if (!cells.length) return "empty";
  return cells.reduce<MdrMilestoneState>((acc, c) =>
    PRIORITY[c.state] > PRIORITY[acc] ? c.state : acc, "empty");
}

export function flattenCells(c: MdrProgressIconCells): MdrPipCell[] {
  return [c.sd, ...c.dd, ...c.cd];
}

export function getMdrProgressTooltipLines(c: MdrProgressIconCells, asOf: string): string[] {
  const lines: string[] = [`Progress as of ${asOf}`];
  const fmt = (d: string | null) => (d ? d.slice(5) : "");
  for (const cell of flattenCells(c)) {
    const lbl = cell.label.padEnd(6);
    const st = MDR_STATE_LABEL[cell.state];
    const extras: string[] = [];
    if (cell.state === "done" && cell.actualDate) extras.push(`actual ${fmt(cell.actualDate)}`);
    else if (cell.planDate) {
      if (cell.state === "delay") {
        const days = Math.floor((new Date(asOf).getTime() - new Date(cell.planDate).getTime()) / 86400000);
        extras.push(`plan ${fmt(cell.planDate)}, overdue ${days}d`);
      } else {
        extras.push(`plan ${fmt(cell.planDate)}`);
      }
    }
    lines.push(`${lbl}: ${st}${extras.length ? ` (${extras.join(", ")})` : ""}`);
  }
  return lines;
}
