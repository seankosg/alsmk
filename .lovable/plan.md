## 문제
`/design/summary` 마일스톤 모니터에서 **WF 미적용** 시 SD/DD/CD Stage 의 A(실적) 값이 0/—로 표시되며, 새 Overall A 컬럼도 0 으로 합산됩니다.

## 원인
`src/components/mdr/MdrMilestoneMonitorPanel.tsx` 의 본문/집계 행이 **WF OFF 일 때 stage 대표값을 "해당 stage 의 마지막 milestone cell"** 로 사용합니다.

- 본문(640~650 라인): `stageSrc[s] = wfEnabled ? row.stageW[s] : row.cells.get(mkKey(s, lm.pct, lm.planDate))`
- 집계(363 라인 부근): `const src = wfEnabled ? sw : lc;`

마지막 milestone(예: CD 100% IFC)은 보통 미시작이라 `actual = 0` 또는 누락. 그래서 Stage A 가 0/—, Overall A 가 0 으로 합산됩니다.

WF 토글의 본래 의미는 **stage → Overall 합성 단계에서 가중치를 적용할지 여부**일 뿐이고, **stage 자체의 진행률은 항상 Summary 산식(`row.stageW`)으로 합성**되어야 합니다.

## 수정
파일 한 곳만 수정: `src/components/mdr/MdrMilestoneMonitorPanel.tsx`

### 1. 본문 행 stageSrc 산출 단순화 (640~650 라인)
```ts
// 변경 전
const lm = lastMsByStage[s];
const lastCell = lm ? row.cells.get(mkKey(s, lm.pct, lm.planDate)) : undefined;
const sw = row.stageW?.[s];
stageSrc[s] = wfEnabled
  ? (sw ? { plan: sw.plan, actual: sw.actual, delta: sw.delta } : null)
  : (lastCell ? { plan: lastCell.plan, actual: lastCell.actual, delta: lastCell.delta } : null);

// 변경 후 — WF 토글과 무관하게 stage 합성값(row.stageW) 사용
const sw = row.stageW?.[s];
stageSrc[s] = sw ? { plan: sw.plan, actual: sw.actual, delta: sw.delta } : null;
```
사용하지 않게 되는 `lastMsByStage` 의존 / 주석 정리.

### 2. 집계 행 src 산출 단순화 (363 라인 부근)
```ts
// 변경 전
const src = wfEnabled ? sw : lc;
// 변경 후
const src = sw;
```
`lc` 계산이 더 이상 필요 없으면 함께 제거.

### 3. WF 토글의 실제 효과 유지
`overallFromStages(stageSrc, wfEnabled)` 는 그대로 둠.
- WF ON: SD 0.2 / DD 0.4 / CD 0.4 가중평균
- WF OFF: SD/DD/CD 단순 산술평균

### 4. 검증
- WF OFF 상태에서 SMP&CCM STR 등 행의 SD/DD/CD Stage A 가 0 이 아닌 단계 합성 실적으로, Overall A 가 그 단순평균으로 표시되는지 확인.
- WF ON 결과가 기존과 동일한지 회귀 확인.
- `tsgo` typecheck 통과 확인.

## 영향 범위
- 단일 파일: `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- 엔진(`milestoneMonitorEngine.ts`, `weights.ts`) 변경 없음.
