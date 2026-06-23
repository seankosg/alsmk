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
  subIdx?: number;        // 셀 단위 진척의 인덱스(0-based). 없으면 그룹 단위로 간주.
  isDone: boolean;
  actualDate?: string | null;
}

/** mdr_milestone_cells 한 행 — 셀 단위 증분 */
export interface MilestoneCellRow {
  stage: MdrStage;
  pct: number;
  subIdx: number;
  incrementPct: number;
  planDate?: string | null;
}

const DAY_MS = 86400000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const dDay = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;

/** 단계의 첫 마일스톤 구간 시작일 결정 — 직전 단계 마지막 plan_date 우선. */
function stageStartDate(
  milestones: MilestoneRow[],
  stage: MdrStage,
  firstPlanDate: string,
): string {
  const prevStage: MdrStage | null = stage === "CD" ? "DD" : stage === "DD" ? "SD" : null;
  if (prevStage) {
    const prevDates = milestones
      .filter((m) => m.stage === prevStage && m.planDate)
      .map((m) => m.planDate as string)
      .sort();
    const last = prevDates[prevDates.length - 1];
    if (last) return last;
  }
  // 폴백: 첫 마일스톤 plan_date − 7일
  return new Date(new Date(firstPlanDate).getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 일일 선형 보간 계획률.
 * - asOf 기준일까지의 계획 진행률(0~100).
 * - 첫 구간 시작일은 직전 단계(SD→DD, DD→CD) 마지막 plan_date.
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
  let prevDate: string = stageStartDate(milestones, stage, list[0].planDate as string);
  for (const m of list) {
    if (!m.planDate) continue;
    if (dDay(asOf, m.planDate) >= 0) {
      acc += m.incrementPct;
      prevDate = m.planDate;
      continue;
    }
    const days = dDay(m.planDate, prevDate);
    const elapsed = dDay(asOf, prevDate);
    const ratio = clamp(days > 0 ? elapsed / days : 0, 0, 1);
    acc += m.incrementPct * ratio;
    break;
  }
  return clamp(acc, 0, 100);
}

/**
 * 도면 단위 — 특정 마일스톤(stage,pct)까지의 누적 계획%.
 * - 첫 구간 시작일 = 직전 단계 마지막 plan_date (폴백: 현재 plan_date − 7일)
 * - 종료일 = 현재 마일스톤 plan_date
 * - SD는 항상 100
 */
export function drawingMilestonePlannedPct(
  milestones: MilestoneRow[],
  stage: MdrStage,
  pct: number,
  asOf: string,
): number {
  if (stage === "SD") return 100;
  const list = milestones
    .filter((m) => m.stage === stage && m.planDate)
    .sort((a, b) => a.pct - b.pct);
  if (!list.length) return 0;

  const stageStart = stageStartDate(milestones, stage, list[0].planDate as string);
  let acc = 0;
  let prevDate: string | null = null;
  for (const m of list) {
    if (!m.planDate) continue;
    const endDate = m.planDate;
    const startDate = prevDate
      ? new Date(new Date(prevDate).getTime() + DAY_MS).toISOString().slice(0, 10)
      : stageStart;
    if (m.pct === pct) {
      if (dDay(asOf, endDate) >= 0) return clamp(acc + m.incrementPct, 0, 100);
      if (dDay(asOf, startDate) <= 0) return clamp(acc, 0, 100);
      const span = dDay(endDate, startDate);
      const elapsed = dDay(asOf, startDate);
      const ratio = clamp(span > 0 ? elapsed / span : 0, 0, 1);
      return clamp(acc + m.incrementPct * ratio, 0, 100);
    }
    acc += m.incrementPct;
    prevDate = endDate;
  }
  return clamp(acc, 0, 100);
}

/** 실적률 — step 함수 (완료된 마일스톤 증분의 합)
 *  - cells(셀 단위 증분)가 제공되면 (stage,pct,subIdx) 정확 매칭으로 합산 → 사용자 직관과 일치.
 *  - 미제공 시 그룹 단위 호환 모드: 어느 셀이라도 isDone 이면 그룹 increment 합산.
 */
export function actualPct(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  stage: MdrStage,
  cells?: MilestoneCellRow[],
): number {
  // 셀 단위 모드
  if (cells && cells.length) {
    let sum = 0;
    for (const cc of cells) {
      if (cc.stage !== stage) continue;
      const matched = progress.find((p) =>
        p.stage === stage && p.pct === cc.pct && (p.subIdx ?? 0) === cc.subIdx && p.isDone
      );
      if (matched) sum += cc.incrementPct;
    }
    return clamp(sum, 0, 100);
  }
  // 그룹 단위 호환 모드 (셀 데이터 없음)
  const incMap = new Map<number, number>();
  for (const m of milestones) if (m.stage === stage) incMap.set(m.pct, m.incrementPct);
  const doneByPct = new Map<number, boolean>();
  for (const p of progress) {
    if (p.stage !== stage) continue;
    if (p.isDone) doneByPct.set(p.pct, true);
  }
  let sum = 0;
  for (const [pct, inc] of incMap.entries()) {
    if (doneByPct.get(pct)) sum += inc;
  }
  return clamp(sum, 0, 100);
}

/** Δ = Planned − Actual (양수 = 지연) */
export function deltaPct(planned: number, actual: number): number {
  return planned - actual;
}

/** 도면 단계별 계획/실적 — SD는 항상 계획·실적 100% (범위 안일 때) */
export function drawingStagePct(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  stage: MdrStage,
  asOf: string,
  cells?: MilestoneCellRow[],
) {
  if (stage === "SD") return { planned: 100, actual: 100, delta: 0 };
  const planned = plannedPctAsOf(milestones, stage, asOf);
  const actual = actualPct(milestones, progress, stage, cells);
  return { planned, actual, delta: planned - actual };
}

export interface DrawingScope {
  sd: boolean;
  dd: boolean;
  cd: boolean;
}

/**
 * 도면 전체 진척률.
 * - inScope 가 주어지면 그 단계만 골라 weight 정규화 (CD-only → CD=100%).
 * - inScope 미지정이면 세 단계 모두 1로 가중평균.
 * - 범위 밖 단계는 sd/dd/cd 객체에 planned=null/actual=null 로 표시.
 */
export function drawingOverall(
  milestones: MilestoneRow[],
  progress: ProgressRow[],
  asOf: string,
  weights: { sd?: number; dd?: number; cd?: number } = { sd: 1, dd: 1, cd: 1 },
  inScope?: DrawingScope,
  cells?: MilestoneCellRow[],
) {
  const w = { sd: weights.sd ?? 1, dd: weights.dd ?? 1, cd: weights.cd ?? 1 };
  const scope: DrawingScope = inScope ?? { sd: true, dd: true, cd: true };

  const stageOf = (s: MdrStage) =>
    drawingStagePct(milestones, progress, s, asOf, cells);

  const sd = scope.sd ? stageOf("SD") : { planned: null, actual: null, delta: null };
  const dd = scope.dd ? stageOf("DD") : { planned: null, actual: null, delta: null };
  const cd = scope.cd ? stageOf("CD") : { planned: null, actual: null, delta: null };

  let pNum = 0, aNum = 0, wSum = 0;
  if (scope.sd) { pNum += (sd.planned ?? 0) * w.sd; aNum += (sd.actual ?? 0) * w.sd; wSum += w.sd; }
  if (scope.dd) { pNum += (dd.planned ?? 0) * w.dd; aNum += (dd.actual ?? 0) * w.dd; wSum += w.dd; }
  if (scope.cd) { pNum += (cd.planned ?? 0) * w.cd; aNum += (cd.actual ?? 0) * w.cd; wSum += w.cd; }

  return {
    sd, dd, cd,
    planned: wSum > 0 ? pNum / wSum : 0,
    actual: wSum > 0 ? aNum / wSum : 0,
  };
}
