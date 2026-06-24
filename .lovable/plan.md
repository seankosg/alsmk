## 변경 요약

**원인**: SD/DD/CD 단계별 도면 개수 컬럼(`drawing_count_sd/dd/cd`)을 마이그레이션으로 추가했지만, 기존 snapshot 행들은 DEFAULT 0 으로 채워져 패널에 0이 표시됨. [신규 계산]을 누르면 정확히 재계산되지만, 매번 사용자가 누르도록 의존하지 않고 **로드 시점에 항상 라이브 카운트로 보정**되도록 변경.

## 수정

### `src/lib/mdr/milestoneMonitorEngine.ts`
- `loadLatestSnapshot()` 끝부분에 헬퍼 호출 추가:
  - 별도 함수 `fetchDrawingCountsByGroup()` 신설 → `mdr_drawings` 에서 `out_of_scope=false` 도면을 `id, building_code, discipline, in_scope_sd/dd/cd` 만 선택해 페이지네이션 로드 후, `(building, normalizeDiscipline(discipline))` 키로 SD/DD/CD true 개수와 totalDrawings 집계.
  - snapshot 로드된 각 `MonitorDiscRow` 의 `drawingCountSD/DD/CD` 와 `drawingCount` 를 이 라이브 집계 값으로 **덮어쓰기**(저장된 0 무시).
  - 매핑 안 되는 행은 0 그대로 유지.

이렇게 하면 사용자가 [신규 계산]을 누르지 않아도 패널 진입 즉시 SD/DD/CD 개수가 올바르게 노출됩니다. `computeMatrix` 결과(snapshot 저장 경로)는 그대로 정확하므로 추가 변경 불필요.

### 검증
- `npm run build` (tsgo)
- `/design/summary` 진입 → 좌측 DWG 컬럼 SD/DD/CD 가 실제 raw 도면 O 개수(예: HSM ARCH = 13/258/259)와 일치하는지 확인.
