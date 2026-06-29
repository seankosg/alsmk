import { describe, it, expect } from "vitest";
import {
  actualPct,
  actualPctUpTo,
  drawingCellPlannedPct,
  drawingStagePct,
  type MilestoneCellRow,
  type MilestoneRow,
  type ProgressRow,
} from "./progressEngine";

/**
 * 회귀: SMP&CCM / ARCH / No.1 (L2Z1-800-EA100-001-B)
 * - DD30 (5+5+10+10=30) 4/4 완료 → 30
 * - DD60 (5+5+10+10=30) sub_idx 0,1,2 완료 → +20  (누계 50)
 * - DD90/100 미완료
 * 기대: DD actual = 50
 */
describe("progressEngine — SMP&CCM ARCH No.1 DD 누적 50% 시나리오", () => {
  const ms: MilestoneRow[] = [
    { stage: "DD", pct: 30, incrementPct: 30, planDate: "2026-05-29" },
    { stage: "DD", pct: 60, incrementPct: 30, planDate: "2026-06-26" },
    { stage: "DD", pct: 90, incrementPct: 30, planDate: "2026-07-31" },
    { stage: "DD", pct: 100, incrementPct: 10, planDate: "2026-08-14" },
  ];
  const cells: MilestoneCellRow[] = [
    { stage: "DD", pct: 30, subIdx: 0, incrementPct: 5 },
    { stage: "DD", pct: 30, subIdx: 1, incrementPct: 5 },
    { stage: "DD", pct: 30, subIdx: 2, incrementPct: 10 },
    { stage: "DD", pct: 30, subIdx: 3, incrementPct: 10 },
    { stage: "DD", pct: 60, subIdx: 0, incrementPct: 5 },
    { stage: "DD", pct: 60, subIdx: 1, incrementPct: 5 },
    { stage: "DD", pct: 60, subIdx: 2, incrementPct: 10 },
    { stage: "DD", pct: 60, subIdx: 3, incrementPct: 10 },
    { stage: "DD", pct: 90, subIdx: 0, incrementPct: 5 },
    { stage: "DD", pct: 90, subIdx: 1, incrementPct: 5 },
    { stage: "DD", pct: 90, subIdx: 2, incrementPct: 5 },
    { stage: "DD", pct: 90, subIdx: 3, incrementPct: 5 },
    { stage: "DD", pct: 90, subIdx: 4, incrementPct: 10 },
    { stage: "DD", pct: 100, subIdx: 0, incrementPct: 5 },
    { stage: "DD", pct: 100, subIdx: 1, incrementPct: 5 },
  ];
  const pg: ProgressRow[] = [
    // DD30 전체 완료
    { stage: "DD", pct: 30, subIdx: 0, isDone: true },
    { stage: "DD", pct: 30, subIdx: 1, isDone: true },
    { stage: "DD", pct: 30, subIdx: 2, isDone: true },
    { stage: "DD", pct: 30, subIdx: 3, isDone: true },
    // DD60 3/4 완료
    { stage: "DD", pct: 60, subIdx: 0, isDone: true },
    { stage: "DD", pct: 60, subIdx: 1, isDone: true },
    { stage: "DD", pct: 60, subIdx: 2, isDone: true },
    { stage: "DD", pct: 60, subIdx: 3, isDone: false },
    // DD90/100 모두 미완료
  ];

  it("actualPct(DD) === 50", () => {
    expect(actualPct(ms, pg, "DD", cells)).toBe(50);
  });

  it("drawingStagePct(DD) — actual=50, delta = actual − planned", () => {
    const r = drawingStagePct(ms, pg, "DD", "2026-06-24", cells);
    expect(r.actual).toBe(50);
    expect(r.delta).toBeCloseTo(r.actual - r.planned, 6);
  });

  it("DD60 sub_idx=3 만 추가 완료 시 actualPct === 60", () => {
    const pg2 = pg.map((p) =>
      p.stage === "DD" && p.pct === 60 && p.subIdx === 3 ? { ...p, isDone: true } : p,
    );
    expect(actualPct(ms, pg2, "DD", cells)).toBe(60);
  });
});

/**
 * 셀(sub_idx) 단위 누적 — 가변 셀 수 회귀.
 * 파일/시트/단계마다 셀 수가 다를 수 있으므로 특정 숫자를 단정하지 않고
 * "셀 수에 비례한 분포" 만 검증한다.
 */
describe("progressEngine — 셀 단위 누적 (가변 셀 수)", () => {
  // 임의 단계: DD pct=30 셀 N개, pct=60 셀 M개. 합 = 100.
  const N = 4;
  const M = 6;
  const inc30 = 30 / N;       // 7.5
  const inc60 = 70 / M;       // ≈11.666…
  const cells: MilestoneCellRow[] = [
    ...Array.from({ length: N }, (_, i) => ({
      stage: "DD" as const, pct: 30, subIdx: i, incrementPct: inc30,
      planDate: `2026-05-${String(8 + i * 7).padStart(2, "0")}`,
    })),
    ...Array.from({ length: M }, (_, i) => ({
      stage: "DD" as const, pct: 60, subIdx: i, incrementPct: inc60,
      planDate: `2026-06-${String(5 + i * 4).padStart(2, "0")}`,
    })),
  ];
  const milestones: MilestoneRow[] = [
    { stage: "DD", pct: 30, incrementPct: 30, planDate: cells[N - 1].planDate! },
    { stage: "DD", pct: 60, incrementPct: 70, planDate: cells[cells.length - 1].planDate! },
  ];

  it("actualPctUpTo: subIdx 미지정은 pct 그룹 전체 누적", () => {
    // pct=30 모두 done → 30
    const pg: ProgressRow[] = cells
      .filter((c) => c.pct === 30)
      .map((c) => ({ stage: "DD" as const, pct: c.pct, subIdx: c.subIdx, isDone: true }));
    expect(actualPctUpTo(milestones, pg, "DD", 30, cells)).toBeCloseTo(30, 6);
  });

  it("actualPctUpTo: subIdx 지정은 (pct, subIdx) 까지만 누적", () => {
    // pct=30 모두 + pct=60 sub_idx=0,1 까지 done → 30 + 2*inc60
    const done: ProgressRow[] = [
      ...cells.filter((c) => c.pct === 30).map((c) => ({ stage: "DD" as const, pct: c.pct, subIdx: c.subIdx, isDone: true })),
      { stage: "DD", pct: 60, subIdx: 0, isDone: true },
      { stage: "DD", pct: 60, subIdx: 1, isDone: true },
    ];
    expect(actualPctUpTo(milestones, done, "DD", 60, cells, 1)).toBeCloseTo(30 + 2 * inc60, 6);
    // 같은 데이터지만 subIdx=0 까지만 → 30 + 1*inc60
    expect(actualPctUpTo(milestones, done, "DD", 60, cells, 0)).toBeCloseTo(30 + inc60, 6);
  });

  it("drawingCellPlannedPct: 셀 plan_date 도달 시 그 셀까지의 누적", () => {
    // asOf = pct=30 마지막 셀 plan_date 이상 → 30
    const asOf = cells[N - 1].planDate as string;
    expect(drawingCellPlannedPct(milestones, cells, "DD", 30, N - 1, asOf)).toBeCloseTo(30, 6);
    // asOf = pct=60 두 번째 셀 plan_date 이상, target = 그 셀 → 30 + 2*inc60
    const asOf2 = cells[N + 1].planDate as string;
    expect(drawingCellPlannedPct(milestones, cells, "DD", 60, 1, asOf2)).toBeCloseTo(30 + 2 * inc60, 6);
  });

  it("drawingCellPlannedPct: 셀 시작일 이전이면 직전 누적 그대로", () => {
    // pct=60 sub_idx=2 의 시작일 직전(= sub_idx=1 plan_date) → 30 + 2*inc60
    const asOf = cells[N + 1].planDate as string;
    expect(drawingCellPlannedPct(milestones, cells, "DD", 60, 2, asOf)).toBeCloseTo(30 + 2 * inc60, 6);
  });

  it("셀 수가 도면별로 달라도 함수가 동일하게 동작 (구조적 검증)", () => {
    // 도면 A: pct=30 셀 2개, 도면 B: pct=30 셀 5개 — 각자 독립적으로 처리.
    const cellsA: MilestoneCellRow[] = [
      { stage: "DD", pct: 30, subIdx: 0, incrementPct: 15, planDate: "2026-05-08" },
      { stage: "DD", pct: 30, subIdx: 1, incrementPct: 15, planDate: "2026-05-15" },
    ];
    const cellsB: MilestoneCellRow[] = Array.from({ length: 5 }, (_, i) => ({
      stage: "DD" as const, pct: 30, subIdx: i, incrementPct: 6,
      planDate: `2026-05-${String(8 + i * 3).padStart(2, "0")}`,
    }));
    const allDone = (cs: MilestoneCellRow[]): ProgressRow[] =>
      cs.map((c) => ({ stage: c.stage, pct: c.pct, subIdx: c.subIdx, isDone: true }));
    expect(actualPctUpTo([{ stage: "DD", pct: 30, incrementPct: 30 }], allDone(cellsA), "DD", 30, cellsA)).toBeCloseTo(30, 6);
    expect(actualPctUpTo([{ stage: "DD", pct: 30, incrementPct: 30 }], allDone(cellsB), "DD", 30, cellsB)).toBeCloseTo(30, 6);
  });
});
