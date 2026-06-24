import { describe, it, expect } from "vitest";
import { actualPct, drawingStagePct, type MilestoneCellRow, type MilestoneRow, type ProgressRow } from "./progressEngine";

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
