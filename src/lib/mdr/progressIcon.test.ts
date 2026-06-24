import { describe, expect, it } from "vitest";
import {
  buildMdrProgressIconCells,
  summarizeGroupState,
  type MdrMilestoneState,
} from "./progressIcon";
import type { MdrStage } from "./parser";

type Ms = Parameters<typeof buildMdrProgressIconCells>[0][number];
type Pg = Parameters<typeof buildMdrProgressIconCells>[1][number];
type Cell = NonNullable<Parameters<typeof buildMdrProgressIconCells>[4]>[number];

const milestone = (stage: MdrStage, pct: number, increment_pct: number, plan_date: string): Ms => ({
  stage,
  pct,
  increment_pct,
  plan_date,
});

const cell = (stage: MdrStage, pct: number, subIdx: number, incrementPct: number): Cell => ({
  stage,
  pct,
  subIdx,
  incrementPct,
});

const done = (stage: MdrStage, pct: number, sub_idx = 0, actual_date = "2026-06-20"): Pg => ({
  stage,
  pct,
  sub_idx,
  is_done: true,
  actual_date,
});

const baseMilestones: Ms[] = [
  milestone("SD", 100, 100, "2026-06-01"),
  milestone("DD", 30, 30, "2026-06-10"),
  milestone("DD", 60, 27, "2026-06-26"),
  milestone("DD", 90, 33, "2026-07-10"),
  milestone("DD", 100, 10, "2026-07-20"),
  milestone("CD", 30, 30, "2026-08-10"),
  milestone("CD", 60, 30, "2026-08-24"),
  milestone("CD", 100, 40, "2026-09-10"),
];

const baseCells: Cell[] = [
  cell("SD", 100, 0, 100),
  cell("DD", 30, 0, 30),
  cell("DD", 60, 0, 20),
  cell("DD", 60, 1, 7),
  cell("DD", 90, 0, 33),
  cell("DD", 100, 0, 10),
  cell("CD", 30, 0, 30),
  cell("CD", 60, 0, 30),
  cell("CD", 100, 0, 40),
];

const build = (
  asOf: string,
  progress: Pg[],
  scope = { sd: true, dd: true, cd: true },
  milestones = baseMilestones,
  cells = baseCells,
) => buildMdrProgressIconCells(milestones, progress, asOf, scope, cells);

describe("buildMdrProgressIconCells", () => {
  it("DD별 누적 P/A로 DD30 done, DD60 delay, DD90 이후 planned를 판정한다", () => {
    const result = build("2026-06-23", [
      done("DD", 30),
      done("DD", 60, 0),
    ]);

    expect(result.dd.map((c) => c.state)).toEqual(["done", "delay", "planned", "planned"]);
    expect(Math.round(result.dd[1].plannedPct ?? 0)).toBe(52);
    expect(Math.round(result.dd[1].actualPct ?? 0)).toBe(50);
  });

  it("P가 해당 pip에 도래하지 않은 DD90/DD100은 실적이 없어도 delay가 아니다", () => {
    const result = build("2026-06-23", [done("DD", 30), done("DD", 60, 0)]);

    expect(result.dd[2].planArrived).toBe(false);
    expect(result.dd[2].state).toBe("planned");
    expect(result.dd[3].planArrived).toBe(false);
    expect(result.dd[3].state).toBe("planned");
  });

  it("미래 pip에 실적이 일부 있으면 delay가 아니라 wip이다", () => {
    const result = build("2026-06-23", [
      done("DD", 30),
      done("DD", 60, 0),
      done("DD", 60, 1),
      done("DD", 90, 0),
    ]);

    expect(result.dd[2].planArrived).toBe(false);
    expect(result.dd[2].state).toBe("wip");
  });

  it("P가 DD60 구간에 도래했지만 누적 A가 누적 P 이상이면 delay가 아니다", () => {
    const result = build("2026-06-23", [
      done("DD", 30),
      done("DD", 60, 0),
      done("DD", 60, 1),
    ]);

    expect(result.dd[1].state).toBe("done");
    expect(result.dd[1].actualPct ?? 0).toBeGreaterThanOrEqual(result.dd[1].plannedPct ?? 0);
  });

  it("P가 DD30 이전이면 DD30도 planned로 남긴다", () => {
    const result = build("2026-06-04", []);

    expect(result.dd[0].planArrived).toBe(false);
    expect(result.dd[0].state).toBe("planned");
  });

  it("CD scope가 꺼진 경우 CD pip는 모두 empty다", () => {
    const result = build("2026-06-23", [], { sd: true, dd: true, cd: false });

    expect(result.cd.map((c) => c.state)).toEqual(["empty", "empty", "empty"]);
  });

  it("CD 계획이 아직 도래하지 않은 경우 CD pip는 planned다", () => {
    const result = build("2026-06-23", [
      done("DD", 30),
      done("DD", 60, 0),
      done("DD", 60, 1),
    ]);

    expect(result.cd.map((c) => c.state)).toEqual(["planned", "planned", "planned"]);
  });

  it("셀 데이터가 없는 레거시 데이터는 그룹 is_done으로 done 판정을 유지한다", () => {
    const result = buildMdrProgressIconCells(
      baseMilestones,
      [{ stage: "DD", pct: 30, is_done: true, actual_date: "2026-06-10" }],
      "2026-06-23",
      { sd: true, dd: true, cd: true },
    );

    expect(result.dd[0].state).toBe("done");
  });

  it("계획이 DD90 구간까지 도래했을 때 누적 A가 누적 P보다 낮으면 DD90만 delay다", () => {
    const result = build("2026-07-01", [
      done("DD", 30),
      done("DD", 60, 0),
      done("DD", 60, 1),
    ]);

    expect(result.dd[0].state).toBe("done");
    expect(result.dd[1].state).toBe("done");
    expect(result.dd[2].planArrived).toBe(true);
    expect(result.dd[2].state).toBe("delay");
    expect(result.dd[3].state).toBe("planned");
  });

  it("summarizeGroupState는 delay를 최우선으로 요약한다", () => {
    expect(summarizeGroupState([
      { stage: "DD", pct: 30, label: "DD30", state: "done", planDate: null, actualDate: null },
      { stage: "DD", pct: 60, label: "DD60", state: "delay", planDate: null, actualDate: null },
      { stage: "DD", pct: 90, label: "DD90", state: "planned", planDate: null, actualDate: null },
    ])).toBe<MdrMilestoneState>("delay");
  });
});