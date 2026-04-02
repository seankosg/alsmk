

# KUKU 대시보드 로직 전면 재설계 + 불필요 코드 정리

## 핵심 문제

현재 KUKU 위젯(`useKukuDashboard`)은 DB를 직접 쿼리하여 데이터를 조합하지만, CPM iframe에서 계산/로딩된 그래프 상태와 DB 저장 타이밍 간의 불일치로 인해 대시보드 진입 시 최신 데이터가 표시되지 않는 문제가 반복됨.

## 해결 전략: CPM Runtime Cache 도입

CPM iframe이 계산한 activity 데이터를 React Query 캐시(`cpm-runtime`)에 저장하고, `useKukuDashboard`가 이 캐시를 1차 데이터 소스로 사용하도록 변경.

```text
현재: iframe → DB upsert → (타이밍 불일치) → useKukuDashboard가 DB 조회
개선: iframe → DB upsert + cpm-runtime 캐시 동시 갱신
      useKukuDashboard → cpm-runtime 캐시 우선 사용, 없으면 DB fallback
```

## 변경 사항

### 1. `src/lib/cpmRuntimeCache.ts` (신규)
- CPM runtime 데이터의 타입 정의 및 캐시 키 상수
- `CpmRuntimeData` 인터페이스: activities 배열 + lastSyncTime

### 2. `src/pages/CpmScheduler.tsx`
- `cpm-calculated` 핸들러에서 DB upsert 후, 같은 activities 데이터를 `queryClient.setQueryData(["cpm-runtime"], ...)` 로 캐시에 직접 저장
- 대시보드 진입 시 hidden iframe에 `request-cpm-data` 메시지를 보내 현재 로딩된 그래프 데이터를 캐시에 동기화하는 로직 추가
- `cpm-runtime-data` 응답 핸들러 추가 (iframe → 캐시 갱신만, DB upsert 없음)

### 3. `src/hooks/useKukuDashboard.ts` (대폭 리팩토링)
- **1차 소스**: `queryClient.getQueryData(["cpm-runtime"])` 에서 activities 가져옴
- **2차 소스**: 캐시 없으면 기존처럼 DB 조회 (fallback)
- 캐시에서 가져온 activities로 KUKU 필터링, pred_links 파싱, predecessor watch 계산
- DB에서는 `cpm_task_mappings` + `tasks` 만 조회 (매핑/진행률 보조 데이터)
- `getEffectiveProgress` 로직 유지 (auto 모드 클라이언트 계산)

### 4. `src/pages/Index.tsx` (대시보드)
- 마운트 시 hidden iframe에 `request-cpm-data` 메시지 전송하여 캐시 동기화 트리거
- 기존 Realtime 구독은 유지하되, `cpm-runtime` 캐시 갱신 시에도 `kuku-dashboard` invalidate

### 5. `src/hooks/useCpmViewModel.ts` 정리
- 스냅샷 조회 시 `updated_at DESC` 기준으로 변경 (auto 스냅샷 덮어쓰기 정책과 일치)
- `batchUpdateElapsedProgress`에서 KUKU 위젯용으로 중복 수행되던 DB write 의존성 축소

### 6. 불필요 코드 정리
- `useKukuDashboard`에서 제거: 스냅샷 조회 관련 레거시 코드 (이전에 스냅샷에서 pred_links 매핑하던 로직의 잔재)
- `Index.tsx`에서 제거: 3개 테이블 Realtime 구독의 중복 debounce 로직 → 단일 debounce 함수로 통합 (이미 통합되어 있으나, `cpm-runtime` 캐시 기반으로 전환하면 `cpm_activities` Realtime 구독 자체가 불필요해짐)
- `CpmScheduler.tsx`의 `cpm-calculated` 핸들러 내 `setTimeout(() => refreshStatus(...), 500)` 중복 호출 정리

### 7. `public/cpm_network.html`
- `request-cpm-data` 메시지 수신 시 현재 로딩된 activities를 `cpm-runtime-data` 타입으로 부모에게 전송하는 핸들러 추가 (DB upsert 없이 경량 동기화)

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `src/lib/cpmRuntimeCache.ts` | 신규 — 타입 및 캐시 키 정의 |
| `src/pages/CpmScheduler.tsx` | runtime 캐시 저장 + 경량 동기화 핸들러 |
| `src/hooks/useKukuDashboard.ts` | 캐시 우선 조회로 리팩토링, 레거시 코드 제거 |
| `src/pages/Index.tsx` | 마운트 시 캐시 동기화 트리거, Realtime 구독 정리 |
| `src/hooks/useCpmViewModel.ts` | 스냅샷 정렬 기준 수정, 중복 로직 정리 |
| `public/cpm_network.html` | `request-cpm-data` 핸들러 추가 |

## 기대 결과
- CPM 페이지 방문 후 대시보드로 이동하면 KUKU 위젯이 즉시 최신 CPM 그래프 기준으로 갱신
- DB 저장 타이밍에 의존하지 않는 안정적 구조
- 불필요한 중복 코드 및 Realtime 구독 정리로 성능 개선

