
# 진도율 첫 구간 시작일 보정

## 변경 파일
`src/lib/mdr/progressEngine.ts` (단일 파일)

## 변경 내용
1. 헬퍼 `stageStartDate(milestones, stage, firstPlanDate)` 추가:
   - `CD` → `DD` 마일스톤의 가장 늦은 `planDate`
   - `DD` → `SD` 마일스톤의 가장 늦은 `planDate`
   - 직전 단계가 없거나 planDate가 없을 때만 `firstPlanDate − 7일` 폴백 사용
2. `plannedPctAsOf` 의 `prevDate` 초기값을 `null` 대신 `stageStartDate(...)` 로 설정. 첫 마일스톤도 다른 구간과 같은 보간 공식 적용.
3. `drawingMilestonePlannedPct` 의 첫 구간 `startDate` 를 `stageStart` 값으로 사용.

## 검증
- 기존 회귀 스크립트 패턴으로 5개 파일(HSM/GEN/SMP_CCM/Main Office/CRM 일부)에서 시트별 DD/CD 합계가 여전히 100%인지 확인.
- 임의 도면 한 건의 `plannedPctAsOf("DD", asOf=오늘)` 가 SD100% planDate 기준 보간으로 계산되는지 콘솔 출력.

## 영향
- DD/CD 첫 마일스톤 보간 결과가 변동(엑셀과 일치하는 방향). SD는 상수 100으로 변동 없음.
- 함수 시그니처 변경 없음 → 호출처(`MdrAdvancedGrid.tsx`) 수정 불필요.
