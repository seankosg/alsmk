/**
 * MDR Progress Icon — 세부 마일스톤별 누적 P/A 비교 기반 분류
 * - done   : 해당 pip가 자체적으로 완료(누적 increment 채움)
 * - delay  : asOf 가 이 pip 의 계획 구간에 진입했고 (per-pip planned > actual)
 * - wip    : asOf 가 진입했고 일부 실적이 있는 경우 (planned ≈ actual 또는 actual > 0)
 * - planned: 아직 이 pip 구간 미진입
 * - empty  : 단계 비범위 또는 마일스톤 미정의
 */
import type { MdrStage } from "./parser";
import { drawingMilestonePlannedPct } from "./progressEngine";

export type MdrMilestoneState = "done" | "wip" | "delay" | "planned" | "empty";

export interface MdrPipCell {
  stage: MdrStage;
  pct: number;
  label: string;
  state: MdrMilestoneState;
  planDate: string | null;
  actualDate: string | null;
  /** 누적 계획률 (단계 합 100 기준) */
  plannedPct?: number;
  /** 누적 실적률 (단계 합 100 기준) */
  actualPct?: number;
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

interface MsRow {
  stage: MdrStage;
  pct: number;
  plan_date: string | null;
  increment_pct?: number | string | null;
}
interface PgRow {
  stage: MdrStage;
  pct: number;
  is_done: boolean;
  actual_date: string | null;
  sub_idx?: number | null;
}
interface CellRow {
  stage: MdrStage;
  pct: number;
  subIdx: number;
  incrementPct: number;
  planDate?: string | null;
}

const EPS = 1e-6;

/**
 * 도면 단위 — 세부 마일스톤별 pip 상태 계산.
 * - cells 가 있으면 셀 단위 increment 로 누적 실적, plannedPctAsOf 보간으로 누적 계획률을 계산.
 * - 두 값의 비교로 done / delay / wip / planned 를 판정.
 * - scope 가 false 인 단계는 모두 empty.
 */
export function buildMdrProgressIconCells(
  milestones: MsRow[],
  progress: PgRow[],
  asOf: string,
  scope?: { sd: boolean; dd: boolean; cd: boolean },
  cells?: CellRow[],
): MdrProgressIconCells {
  const sc = scope ?? { sd: true, dd: true, cd: true };

  // engine 용 normalized milestones (camelCase)
  const msNorm = milestones.map((m) => ({
    stage: m.stage,
    pct: Number(m.pct),
    incrementPct: Number(m.increment_pct ?? 0),
    planDate: m.plan_date ?? null,
  }));

  const findMs = (stage: MdrStage, pct: number) =>
    milestones.find((m) => m.stage === stage && m.pct === pct);

  // 단계별 sub-cell 합 → 누적 실적 / 누적 목표
  const stageActualUpTo = (stage: MdrStage, pct: number): number => {
    if (cells && cells.length) {
      let sum = 0;
      for (const cc of cells) {
        if (cc.stage !== stage || cc.pct > pct) continue;
        const done = progress.some((p) =>
          p.stage === stage && p.pct === cc.pct &&
          (p.sub_idx ?? 0) === cc.subIdx && p.is_done,
        );
        if (done) sum += cc.incrementPct;
      }
      return sum;
    }
    // 셀 데이터 없을 때(레거시): 그룹 단위 increment 합산
    let sum = 0;
    for (const m of msNorm) {
      if (m.stage !== stage || m.pct > pct) continue;
      const anyDone = progress.some((p) => p.stage === stage && p.pct === m.pct && p.is_done);
      if (anyDone) sum += m.incrementPct;
    }
    return sum;
  };

  const stageTargetUpTo = (stage: MdrStage, pct: number): number =>
    msNorm.filter((m) => m.stage === stage && m.pct <= pct)
      .reduce((s, m) => s + m.incrementPct, 0);

  // 최신 actual_date — 해당 pct 그룹 내 완료 sub-cell 중 가장 늦은 일자
  const latestActualDate = (stage: MdrStage, pct: number): string | null => {
    let latest: string | null = null;
    for (const p of progress) {
      if (p.stage !== stage || p.pct !== pct || !p.is_done) continue;
      const ad = p.actual_date ?? null;
      if (ad && (!latest || ad > latest)) latest = ad;
    }
    return latest;
  };

  // SD: 단일 pip — scope 면 done (SD는 단계 정의상 항상 완료)
  const sdMs = findMs("SD", 100);
  const sdActual = stageActualUpTo("SD", 100);
  const sdTarget = stageTargetUpTo("SD", 100);
  const sd: MdrPipCell = {
    stage: "SD",
    pct: 100,
    label: "SD",
    state: sc.sd ? "done" : "empty",
    planDate: sdMs?.plan_date ?? null,
    actualDate: latestActualDate("SD", 100),
    plannedPct: sc.sd ? 100 : 0,
    actualPct: sc.sd ? (sdTarget > 0 ? Math.min(100, (sdActual / sdTarget) * 100) : 100) : 0,
  };

  const buildSeq = (stage: MdrStage, pcts: readonly number[], prevStageDoneFlag: boolean): MdrPipCell[] => {
    // 각 pip 의 누적 P / A 를 미리 계산
    const stageTotal = msNorm
      .filter((m) => m.stage === stage)
      .reduce((s, m) => s + m.incrementPct, 0);

    let prevPlannedCum = 0; // 단계 합 100 기준 (drawingMilestonePlannedPct 가 0~100 반환)
    let prevActualCum = 0;
    let prevDone = prevStageDoneFlag;

    return pcts.map((p) => {
      const ms = findMs(stage, p);
      const actualCum = stageTotal > 0 ? (stageActualUpTo(stage, p) / stageTotal) * 100 : 0;
      const plannedCum = ms ? drawingMilestonePlannedPct(msNorm, stage, p, asOf) : prevPlannedCum;

      const pipPlanned = Math.max(0, plannedCum - prevPlannedCum);
      const pipActual = Math.max(0, actualCum - prevActualCum);
      const pipTarget = stageTotal > 0 ? (Number(ms?.increment_pct ?? 0) / stageTotal) * 100 : 0;

      let state: MdrMilestoneState;
      if (!ms) {
        state = "empty";
      } else if (pipActual + EPS >= pipTarget && pipTarget > 0) {
        state = "done";
      } else if (pipPlanned > EPS) {
        // asOf 가 이 pip 구간에 진입함
        if (pipPlanned > pipActual + EPS) state = "delay";
        else state = pipActual > EPS ? "wip" : "delay";
      } else {
        // pip 구간 미진입
        if (pipActual > EPS) state = "wip";
        else if (prevDone) state = "wip";
        else state = "planned";
      }

      const cell: MdrPipCell = {
        stage,
        pct: p,
        label: `${stage}${p}`,
        state,
        planDate: ms?.plan_date ?? null,
        actualDate: latestActualDate(stage, p),
        plannedPct: plannedCum,
        actualPct: actualCum,
      };

      prevPlannedCum = plannedCum;
      prevActualCum = actualCum;
      prevDone = state === "done";
      return cell;
    });
  };

  const buildEmpty = (stage: MdrStage, pcts: readonly number[]): MdrPipCell[] =>
    pcts.map((p) => ({
      stage, pct: p, label: `${stage}${p}`,
      state: "empty" as MdrMilestoneState,
      planDate: null, actualDate: null,
      plannedPct: 0, actualPct: 0,
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
    if (cell.plannedPct != null && cell.actualPct != null && cell.state !== "empty") {
      extras.push(`P ${Math.round(cell.plannedPct)} / A ${Math.round(cell.actualPct)}`);
    }
    if (cell.state === "done" && cell.actualDate) {
      extras.push(`actual ${fmt(cell.actualDate)}`);
    } else if (cell.planDate) {
      if (cell.state === "delay") {
        const days = Math.floor((new Date(asOf).getTime() - new Date(cell.planDate).getTime()) / 86400000);
        if (days > 0) extras.push(`plan ${fmt(cell.planDate)}, overdue ${days}d`);
        else extras.push(`plan ${fmt(cell.planDate)}`);
      } else {
        extras.push(`plan ${fmt(cell.planDate)}`);
      }
    }
    lines.push(`${lbl}: ${st}${extras.length ? ` (${extras.join(", ")})` : ""}`);
  }
  return lines;
}
