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

interface MsRow { stage: MdrStage; pct: number; plan_date: string | null }
interface PgRow { stage: MdrStage; pct: number; is_done: boolean; actual_date: string | null }

function classify(
  stage: MdrStage,
  pct: number,
  ms: MsRow | undefined,
  pg: PgRow | undefined,
  prevDone: boolean,
  asOf: string,
): MdrMilestoneState {
  if (!ms) return "empty";
  if (pg?.is_done) return "done";
  if (ms.plan_date && ms.plan_date < asOf) return "delay";
  if (prevDone) return "wip";
  return "planned";
}

/**
 * SD는 항상 단일 done Pip (SD100). DD/CD는 정의된 마일스톤 기준.
 */
export function buildMdrProgressIconCells(
  milestones: MsRow[],
  progress: PgRow[],
  asOf: string,
): MdrProgressIconCells {
  const find = (stage: MdrStage, pct: number) => ({
    ms: milestones.find((m) => m.stage === stage && m.pct === pct),
    pg: progress.find((p) => p.stage === stage && p.pct === pct),
  });

  // SD: 100만, 항상 done
  const sdFind = find("SD", 100);
  const sd: MdrPipCell = {
    stage: "SD",
    pct: 100,
    label: "SD",
    state: "done",
    planDate: sdFind.ms?.plan_date ?? null,
    actualDate: sdFind.pg?.actual_date ?? null,
  };

  const buildSeq = (stage: MdrStage, pcts: readonly number[]): MdrPipCell[] => {
    let prevDone = true; // 그룹 시작 직전(SD) 완료로 간주
    return pcts.map((p) => {
      const { ms, pg } = find(stage, p);
      const state = classify(stage, p, ms, pg, prevDone, asOf);
      prevDone = state === "done";
      return {
        stage,
        pct: p,
        label: `${stage}${p}`,
        state,
        planDate: ms?.plan_date ?? null,
        actualDate: pg?.actual_date ?? null,
      };
    });
  };

  return {
    sd,
    dd: buildSeq("DD", DD_PIP_PCTS),
    cd: buildSeq("CD", CD_PIP_PCTS),
  };
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
