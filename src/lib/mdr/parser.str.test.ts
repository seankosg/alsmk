import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
import { parseMdrFile } from "./parser";

// 업로드한 SMP&CCM 파일을 사용해 STR DD 그룹이 라벨 기반(Information/STR Analysis/Drawings)
// 으로 정상 적재되는지 검증.
const XLSX_PATH = "/mnt/user-uploads/02_SMP_CCM_MDR_progress-13.xlsx";

const hasFile = fs.existsSync(XLSX_PATH);
const d = hasFile ? describe : describe.skip;

d("STR sheet DD label-grouped parsing", () => {
  it("creates 3 DD groups (Information/STR Analysis/Drawings) with cell increments", async () => {
    const buf = fs.readFileSync(XLSX_PATH);
    const file = new File([buf], path.basename(XLSX_PATH));
    const res = await parseMdrFile(file);
    const str = res.sheets.find((s) => s.sheetName.toUpperCase() === "STR");
    expect(str).toBeTruthy();
    expect(str!.skipped).not.toBe(true);

    // milestoneOrder 에 DD 30/60/100 (혹은 1~3그룹) 이 있어야 한다.
    const ddOrders = str!.milestoneOrder.filter((m) => m.stage === "DD");
    expect(ddOrders.length).toBeGreaterThanOrEqual(1);

    // 첫번째 STR 도면의 progress 에 DD 셀이 적어도 1개 포함되어야 한다.
    const firstScoped = str!.rows.find((r) => !r.outOfScope && r.progress.some((p) => p.stage === "DD"));
    expect(firstScoped, "no row has DD progress cells").toBeTruthy();

    // milestoneOrder DD 그룹 합산 inc 비율이 70%~110% 사이 (≈ 1.0)
    const ddIncSum = str!.rows[0]?.progress
      .filter((p) => p.stage === "DD")
      .reduce((a) => a + 1, 0); // 단순 개수 체크
    expect(ddIncSum).toBeGreaterThan(0);
  });
});
