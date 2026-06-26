## 문제 진단

설계진도율 패널은 마운트 때마다 `computeMatrix(today)`를 호출합니다.
- `loadDrawings()`: `mdr_drawings` + 중첩 3개(`mdr_milestones`, `mdr_milestone_cells`, `mdr_progress`)을 1000건씩 페이지네이션으로 전부 적재
- `buildMatrix()`: 도면별로 단계×마일스톤×cell 루프(O(도면 × 마일스톤 × cell))를 매번 재계산
실시간으로 바뀌는 값이 거의 없는데도 **매 진입마다** 무거운 풀계산이 반복됩니다.

스냅샷 인프라(`mdr_milestone_snapshots`, `loadLatestSnapshot()`, `saveSnapshot()`)는 이미 존재하지만 패널이 사용하지 않습니다.

## 효율화 전략 — "스냅샷 우선, 임포트시 무효화" 모델

### 1. 패널 초기 로드: 스냅샷 우선
- `useEffect` 초기 로드를 `loadLatestSnapshot()` → 성공시 즉시 표시
- 스냅샷이 없을 때만 `computeMatrix(today)` fallback 후 자동으로 `saveSnapshot()`
- 화면 상단에 "기준일 / 마지막 계산: yyyy-mm-dd hh:mm" 표시 + 스냅샷이 N일 이상 오래되었거나 임포트보다 오래되었으면 "재계산 필요" 배지

### 2. "신규 계산" 버튼: 풀 재계산 + 스냅샷 저장 (현행 유지)
- 기존 `handleRecompute` 로직 유지하되 진행 토스트("계산 중…") 보강

### 3. 임포트 완료시 자동 무효화 → 백그라운드 재계산
- `mdr_import_logs`에 `created_at` 컬럼이 있다는 점을 이용해 **최신 임포트 시각 > 최신 스냅샷 `computed_at`** 이면 "데이터 변경됨 — 재계산 필요" 배너 노출.
- `useMdrImporter`의 `startImport()` 성공 분기(`onImported?.()` 직전)에 옵션으로 `triggerRecompute` 콜백을 받아, 임포트 직후 한 번만 `computeMatrix + saveSnapshot`을 비동기 실행. UI 차단 없이 백그라운드 진행, 완료시 toast "설계진도율 스냅샷 갱신 완료".

### 4. `saveSnapshot()` 성능 개선
- 현재: building×discipline 단위로 개별 DELETE 루프(N회) → INSERT 청크
- 개선: 한 번의 DELETE (`.eq("as_of", asOf)`) 후 청크 INSERT. 단일 트랜잭션 효과로 왕복 N → 1+M으로 축소.
- UNIQUE 제약(`as_of, building, discipline, stage, pct`)이 이미 존재 → 안전.

### 5. (선택) `loadDrawings()` 페이로드 축소
- 풀계산 자체를 빠르게 하기 위해, 풀계산 경로에서만 사용되는 `mdr_milestone_cells.label` 등 표시에만 필요한 필드는 조회에서 제외해도 무방. 다만 우선순위 낮음 — 1~3번만으로도 패널 첫 페인트는 1회 SELECT(snapshot)로 단축됨.

## 작업 파일
- `src/lib/mdr/milestoneMonitorEngine.ts` — `saveSnapshot` DELETE 일괄화, `loadLatestSnapshot` 보조로 `computed_at`/최신 임포트 시각 반환 추가
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` — 초기 로드 스냅샷 우선, "재계산 필요" 배지, 마지막 계산 시각 표시
- `src/components/mdr/import/useMdrImporter.ts` — 임포트 완료 후 백그라운드 재계산 트리거(옵션 콜백)
- `src/pages/DesignImport.tsx` (또는 ImportShell) — 위 콜백으로 `computeMatrix + saveSnapshot` 연결

## 비변경
- 산식/가중치/엔진 결과(수치는 동일)
- DB 스키마(컬럼/제약 그대로). 마이그레이션 없음.

## 기대 효과
- 패널 첫 진입: 도면 전체 조회 + buildMatrix(수초~) → 스냅샷 단일 SELECT(수십~수백 ms) 수준으로 단축
- 임포트가 없는 한 화면 재진입은 항상 즉시 표시
- "신규 계산" 버튼은 명시적 풀계산용으로 그대로 유지