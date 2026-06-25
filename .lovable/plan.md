## 문제
마일스톤 모니터링 테이블의 Building 필터/행에 `MAIN_OFFICE` 하나만 표시됨.

## 원인
`MdrMilestoneMonitorPanel` 초기 로드 로직이 **snapshot 우선** 방식인데, 현재 `mdr_milestone_snapshots` 테이블에 `MAIN_OFFICE/MECH` 행 하나만 저장되어 있음. 다른 건물(CRM/HSM/SMP&CCM/GEN/FAFP)은 mdr_drawings 에는 존재하지만 snapshot 에 없어서 표시되지 않음.

```ts
// 현재 동작 (milestoneMonitorEngine.ts loadLatestSnapshot)
//  → 가장 최신 as_of 행들만 가져옴 → 부분 snapshot 이면 나머지 건물 누락
```

## 해결책 (요약)
초기 로드 시 **항상 라이브 `computeMatrix(today)` 호출**로 단순화. snapshot 은 [신규 계산] 버튼으로 저장된 결과의 "캐시"가 아니라, 라이브 매트릭스로 즉시 갱신되도록 한다. 부분 snapshot 으로 인한 누락 가능성을 원천 제거.

### 변경 파일
**`src/components/mdr/MdrMilestoneMonitorPanel.tsx`**
- 초기 `useEffect`에서 `loadLatestSnapshot()` 대신 `computeMatrix(today)` 를 호출.
- snapshot 의 `as_of` 표시 의도는 유지: 라이브 계산이 끝나면 그 결과의 `asOf` 를 그대로 사용.
- 신규 계산 버튼 동작은 그대로(라이브 계산 + saveSnapshot).
- 도면이 0개일 때만 빈 카드 표시.

이 단순화로 사용자가 별도 [신규 계산] 클릭 없이도 페이지 진입 시 모든 건물이 정상 표시됨.

## 대안 (참고만)
- `loadLatestSnapshot()` 후 `mdr_drawings` 의 distinct buildings 개수와 비교해서 부족하면 자동 재계산. → 복잡, 효과는 동일.
- snapshot 테이블의 stale 행 삭제. → 일회성, 같은 문제 재발 가능.

## 기술 메모
- `computeMatrix` 는 mdr_drawings + milestones/cells/progress 를 페이지네이션으로 전부 로드 후 메모리에서 집계. 데이터량(~4000 도면)에서 1-2초 수준이라 초기 로드에 적합.
- snapshot 저장 로직(`saveSnapshot`) 자체는 보존 — 명시적 신규 계산 시 캐시로 유지.
