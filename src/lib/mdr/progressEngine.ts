import type { MdrStage } from "./parser";

export interface MilestoneRow {
  stage: MdrStage;
  pct: number;
  incrementPct: number;
  planDate?: string | null;
}

export interface ProgressRow {
  stage: MdrStage;
  pct: number;
  isDone: boolean;
  actualDate?: string | null;
}

const DAY_MS = 86400000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const dDay = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;

/**
 * 일일 선형 보간 계획률.
 * - asOf 기준일까지의 계획 진행률(0~100).
 * - 직전 마일스톤 plan_date → 현재 마일스톤 plan_date 사이를 일자별 선형 분배.
 */
export function plannedPctAsOf(
  milestones: MilestoneRow[],
  stage: MdrStage,
  asOf: string,
): number {
  const list = milestones
    .filter((m) => m.stage === stage && m.planDate)
    .sort((a, b) => a.pct - b.pct);
  if (!list.length) return 0;

  let acc = 0;
  let prevDate: string | null = null;
  for (const m of list) {
    if (!m.planDate) continue;
    const days = prevDate ? dDay(m.planDate, prevDate) : 7;
    const elapsed = prevDate ? dDay(asOf, prevDate) : dDay(asOf, m.planDate) + 7;
    if (dDay(asOf, m.planDate) >= 0) {
      acc += m.incrementPct;
    } else {
      const ratio = clamp(days > 0 ? elapsed / days : 0, 0, 1);
      acc += m.incrementPct * ratio;
      break;
    }
    prevDate = m.planDate;
  }
  return clamp(acc, 0, 100);
}

/** 실적률 — step 함수 (완료된 마일스톤 증분의 합) */
export function actualPct(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  stage: MdrStage,
): number {
  const incMap = new Map<number, number>();
  for (const m of milestones) if (m.stage === stage) incMap.set(m.pct, m.incrementPct);
  let sum = 0;
  for (const p of progress) {
    if (p.stage === stage && p.isDone) sum += incMap.get(p.pct) ?? 0;
  }
  return clamp(sum, 0, 100);
}

/** Δ = Planned − Actual (양수 = 지연) */
export function deltaPct(planned: number, actual: number): number {
  return planned - actual;
}

/** 도면 단계별 계획/실적 — SD는 항상 계획·실적 100% */
export function drawingStagePct(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  stage: MdrStage,
  asOf: string,
) {
  if (stage === "SD") return { planned: 100, actual: 100, delta: 0 };
  const planned = plannedPctAsOf(milestones, stage, asOf);
  const actual = actualPct(milestones, progress, stage);
  return { planned, actual, delta: planned - actual };
}

/** 도면 전체 (SD=100 상수, DD+CD 가중평균 — 기본 균등) */
export function drawingOverall(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  asOf: string,
  weights: { sd?: number; dd?: number; cd?: number } = { sd: 1, dd: 1, cd: 1 },
) {
  const sd = drawingStagePct(milestones, progress, "SD", asOf);
  const dd = drawingStagePct(milestones, progress, "DD", asOf);
  const cd = drawingStagePct(milestones, progress, "CD", asOf);
  const w = { sd: weights.sd ?? 1, dd: weights.dd ?? 1, cd: weights.cd ?? 1 };
  const wsum = w.sd + w.dd + w.cd;
  return {
    sd, dd, cd,
    planned: (sd.planned * w.sd + dd.planned * w.dd + cd.planned * w.cd) / wsum,
    actual: (sd.actual * w.sd + dd.actual * w.dd + cd.actual * w.cd) / wsum,
  };
}
