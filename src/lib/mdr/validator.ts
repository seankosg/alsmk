import type { MdrParsedSheet, MdrStage } from "./parser";

export interface MdrValidationIssue {
  sheetName: string;
  stage: MdrStage;
  expectedSum: number;
  actualSum: number;
  delta: number;
  /** 누계 → 차분 자동 보정 가능 여부 */
  canAutoFix: boolean;
  fixedIncrements?: number[];
}

export interface MdrValidationReport {
  sheetName: string;
  issues: MdrValidationIssue[];
  ok: boolean;
}

/**
 * DD/CD 증분 합이 100%(±1)인지 검증.
 * 실패 시 누계 데이터로 보고 차분(diff)을 시도해 자동 보정 후보를 생성.
 */
export function validateSheet(sheet: MdrParsedSheet): MdrValidationReport {
  const issues: MdrValidationIssue[] = [];
  for (const stage of ["DD", "CD"] as MdrStage[]) {
    const cols = sheet.rows[0]?.milestones.filter((m) => m.stage === stage) ?? [];
    if (!cols.length) continue;
    const incs = cols.map((c) => c.incrementPct);
    const sum = incs.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 1) {
      // 누계로 가정하고 차분 시도
      const sortedByPct = [...cols].sort((a, b) => a.pct - b.pct);
      const cumulative = sortedByPct.map((c) => c.incrementPct);
      let canAutoFix = false;
      let fixedIncrements: number[] | undefined;
      if (cumulative[cumulative.length - 1] >= 99 && cumulative[cumulative.length - 1] <= 101) {
        // 누계 패턴: 차분 계산
        const diffs = cumulative.map((v, i) => (i === 0 ? v : v - cumulative[i - 1]));
        if (diffs.every((d) => d >= -1)) {
          canAutoFix = true;
          fixedIncrements = diffs;
        }
      }
      issues.push({
        sheetName: sheet.sheetName,
        stage,
        expectedSum: 100,
        actualSum: sum,
        delta: sum - 100,
        canAutoFix,
        fixedIncrements,
      });
    }
  }
  return { sheetName: sheet.sheetName, issues, ok: issues.length === 0 };
}

export function applyAutoFix(sheet: MdrParsedSheet, issue: MdrValidationIssue) {
  if (!issue.fixedIncrements) return;
  const cols = sheet.rows[0]?.milestones.filter((m) => m.stage === issue.stage) ?? [];
  const sorted = [...cols].sort((a, b) => a.pct - b.pct);
  sorted.forEach((c, i) => (c.incrementPct = issue.fixedIncrements![i]));
  // rows 안 milestone 객체에도 반영
  for (const row of sheet.rows) {
    const rowCols = row.milestones.filter((m) => m.stage === issue.stage).sort((a, b) => a.pct - b.pct);
    rowCols.forEach((c, i) => (c.incrementPct = issue.fixedIncrements![i]));
  }
}
