## 배경

- 엑셀(`02_SMP_CCM_MDR_progress-10.xlsx`, ARCH 시트, No.1 도면 `L2Z1-800-EA100-001-B`) 및 DB 확인 결과 **DD 단계 누적 실적 = 50%** 가 정확합니다.
  - DD30(4 sub, weight 5/5/10/10): 4/4 완료 → 30
  - DD60(4 sub, weight 5/5/10/10): sub_idx 0,1,2 완료 → +20
  - 누계 = 50, 엑셀 `DD Progress` 셀(0.5)과 일치
- 그런데 그리드 **'DD A'(또는 'DD60 A')** 셀이 0%로 표시됩니다.
- 코드(`actualPct`, `buildCell`) 로직만으로는 50이 나와야 하므로, 표시 단계의 데이터 흐름에 회귀가 있는 것으로 추정됩니다.

## 진단 (Step 1)

1. Playwright로 `/design` → SMP&CCM → ARCH 탭 → No.1 행을 캡처해 실제 화면값을 확인합니다.
2. 동시에 브라우저 콘솔에 `window.__mdrDebugRow = row` 임시 노출 또는 React DevTools 없이 확인 가능하도록 `MdrAdvancedGrid.tsx`의 row 매핑 직후 다음을 임시 로그합니다(진단 후 제거).
   - `console.debug('[mdr] row', d.source_no, { ddActual: dd.actual, ddCells, cellRowsLen: cellRows.length, pgRowsLen: pgRows.length });`
3. 이를 통해 다음 중 어느 경우인지 분기합니다.
   - (A) `dd.actual = 50`인데 컬럼 렌더링 단계에서 0 표시 → `columns.tsx`의 accessor / 정렬 / 필터 회귀
   - (B) `dd.actual = 0` → `actualPct()` 또는 `cellRows/pgRows` 정규화 회귀
   - (C) `cellRows.length = 0` 또는 `pgRows.length = 0` → Supabase 중첩 select 실패(`mdr_milestone_cells(*), mdr_progress(*)`) 또는 RLS

## 수정 (Step 2 — 진단 결과에 따라 분기)

### (A) 컬럼 렌더링 회귀인 경우
- `src/components/mdr/grid/columns.tsx` `dd_a` accessor (`(r as any)['dd_a']`)가 0이 아닌 값을 받는지 확인.
- `Math.round` / null 처리 / 0과 null 혼동(예: `??` vs `||`) 회귀를 수정.

### (B) `actualPct()` 회귀인 경우
- `src/lib/mdr/progressEngine.ts` `actualPct()` 의 cells/progress 매칭 키 (`stage`, `pct`, `subIdx`, `isDone`) 정규화 확인.
- `Number(x.sub_idx ?? 0)` vs `null` 비교 회귀 수정.

### (C) 데이터 fetch 회귀인 경우
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`의 `.select("*, mdr_milestones(*), mdr_milestone_cells(*), mdr_progress(*)")` 응답을 확인.
- 누락 시 select 문자열 재작성 또는 별도 query 분리.

## 검증 (Step 3)

1. 진단 로그 제거.
2. Playwright 재실행 — No.1 행의 `DD A` 셀이 **50** 으로 표시되는지 스크린샷으로 검증.
3. 기존 `progressIcon.test.ts` 외 `progressEngine.test.ts` (또는 동일 파일)에 다음 시나리오 회귀 테스트 추가:
   - DD30 4/4 완료 + DD60 3/4 완료 + DD90/100 미완료 → `actualPct(... "DD" ...) === 50`
   - 같은 데이터로 `drawingStagePct(..., "DD", ...)`의 `actual === 50`, `delta === actual − planned`
4. 변경 없는 다른 행(예: ARCH No.2, MECH 등)의 `DD A` 값이 그대로 유지되는지 sampling 확인.

## 변경 예정 파일

- (진단) `src/components/mdr/grid/MdrAdvancedGrid.tsx` — 임시 디버그 로그 후 제거
- (수정 대상) 위 (A)/(B)/(C) 중 한 곳
- (검증) `src/lib/mdr/progressEngine.test.ts` 신규 또는 보강

## 범위 외 (이번 수정에서 다루지 않음)

- Progress Icon 아이콘 색상 분류(`progressIcon.ts`) — 이미 이전 라운드에서 수정 완료, 본 이슈는 **그리드 Actual 컬럼 표시값** 한정.
- 엑셀 import 로직 — DB에 이미 50%가 정확히 들어있어 import는 정상.
