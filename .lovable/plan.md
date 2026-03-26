
# CPM Manager 전면 재검토 계획

## 결론

현재 문제는 개별 버그 3개가 아니라, **CPM의 기준 데이터가 3군데로 분산**되어 있기 때문에 반복적으로 발생합니다.

현재 상태 소스:
1. iframe 내부 메모리 `activities`
2. 브라우저별 `localStorage`
3. 백엔드의 `cpm_snapshots` + `cpm_activities` + `cpm_task_mappings`

이 구조에서는 새로고침/타기기/권한차이/응답순서에 따라 서로 다른 버전이 섞여서:
- 매핑이 사라져 보이고
- BLDG가 늦게 붙고
- 상태 아이콘이 처음엔 없다가 나중에 생기고
- 브라우저별 표시가 달라집니다.

따라서 **근원 해결책은 “스냅샷 중심 복원”에서 “정규화된 DB 중심 조립”으로 바꾸는 것**입니다.

---

## 확인된 핵심 원인

### 1. 기존 매핑된 태스크가 사라짐
원인:
- 현재 화면 복원은 `localStorage` 우선입니다.
- `MapTasksDialog`는 DB에 매핑을 저장하지만, iframe의 `activities` 자체는 갱신하지 않습니다.
- 이후 새로고침 시 로컬/DB 스냅샷 중 오래된 것이 복원되면, 최신 매핑/상태와 어긋난 화면이 만들어집니다.
- 일반사용자는 스냅샷 저장 권한이 없어서 더 쉽게 불일치가 납니다.

### 2. 타 기기 최초 접속 시 BLDG 배지가 안 뜸
원인:
- BLDG는 snapshot 안의 `customFields` 또는 별도 패치 메시지에 의존합니다.
- 즉, 최초 렌더가 스냅샷 기준이고, `cpm_activities.custom_fields`는 뒤늦게 patch 됩니다.
- 그래서 첫 화면에서 BLDG가 비어 있고, 후속 patch/재계산이 와야 나타납니다.

### 3. 상태 아이콘이 최초에 생성되지 않고 필터 후 생김
원인:
- 노드 상태 아이콘은 `window._activityStatusMap`이 도착해야만 표시됩니다.
- 그런데 네트워크는 먼저 그려지고, 상태 맵은 React 쪽 별도 쿼리 후 postMessage로 나중에 도착합니다.
- 즉, 초기 렌더와 상태 렌더가 분리되어 있어 타이밍 이슈가 생깁니다.

### 4. 추가 구조 문제
- `localStorage savedAt >= DB snapshot savedAt`이면 DB 복원을 건너뜀
- 브라우저마다 localStorage가 다르므로 기기간 최신성 보장이 안 됨
- snapshot, activities, mappings가 서로 원자적으로 저장되지 않음
- tooltip은 상태 키를 다른 형식으로 읽고 있어 네트워크 노드와 일관성이 깨질 수 있음
- `patch-custom-fields`에서 재렌더에 전역 계산값 의존 흔적이 있어 구조가 불안정함

---

## 근원적인 해결 방향

## 1. 단일 기준 데이터로 통합
**CPM의 기준 원본을 `cpm_activities + cpm_task_mappings + tasks`로 통일**합니다.

의미:
- 화면 복원용 JSON 스냅샷을 “정답”으로 쓰지 않음
- 스냅샷은 관리자용 “버전 저장/복원” 기능으로만 사용
- 일반 접속/새로고침/타기기 진입은 항상 DB 기준으로 조립

즉:
- `cpm_activities` = activity 구조/일정/custom_fields
- `cpm_task_mappings` = 활동-태스크 연결
- `tasks` = 상태 계산의 원본
- `cpm_snapshots` = 선택적 버전 관리

---

## 2. 초기 로딩 플로우 재설계
현재:
`iframe init -> localStorage/DB snapshot/patch/status` 순서 경쟁

변경:
`React 부모가 먼저 CPM payload를 조립 -> iframe에 1회 전달 -> iframe은 즉시 렌더`

초기 payload에 포함:
- activities
- customFields(BLDG 포함)
- mapping summary
- node status summary
- version metadata
- active filters(optional)

이렇게 하면:
- 최초 렌더부터 BLDG 표시 가능
- 최초 렌더부터 상태 아이콘 표시 가능
- 필터 전에도 정상 동작
- 타 기기에서도 동일 결과

---

## 3. localStorage 역할 축소
`localStorage`는 더 이상 기준 데이터가 아니라:
- 패널 width
- 선택된 탭
- 임시 UI 상태
- 선택 필터 정도만 저장

저장 금지:
- 전체 activities 스냅샷
- customFields 원본
- 최신성 판단용 savedAt 기준 데이터

즉, `loadFromStorage()` / `saveToStorage()`의 CPM 본문 저장 로직을 제거하거나 UI 캐시 전용으로 축소합니다.

---

## 4. 상태 계산 위치 통합
현재는 상태 아이콘이 React에서 따로 계산되어 postMessage로 늦게 옵니다.

변경:
- React 부모에서 초기 CPM payload를 만들 때 활동별 status를 함께 계산
- iframe은 별도 후속 메시지 없이 바로 노드 렌더
- 매핑 변경 후에도 React가 status를 재조회해 iframe에 즉시 delta 또는 full refresh 전송

이렇게 하면:
- “처음엔 아이콘 없음” 제거
- tooltip / side panel / network node가 같은 계산값 사용

---

## 5. 일반사용자 매핑 반영 구조 개선
목표:
- 일반사용자도 매핑 가능
- 하지만 스냅샷 저장 버튼은 없음
- 여러 사용자가 동시에 접속해도 최신 매핑 반영

해결:
- 매핑 저장은 `cpm_task_mappings`만 수정
- 저장 후 React 부모가 DB 재조회 → 최신 status/mapping summary 재계산 → iframe 즉시 갱신
- 자동 스냅샷 저장과 분리
- 필요하면 realtime 또는 query invalidation으로 다른 접속자도 동기화

즉, **매핑은 snapshot이 아니라 normalized DB에 바로 반영되는 collaborative data**로 취급합니다.

---

## 구현 계획

### A. 데이터 계층 정리
1. React 쪽에 `loadCpmViewModel()` 형태의 통합 로더 추가
2. 이 로더가 `cpm_activities`, `cpm_task_mappings`, `tasks`를 읽어 단일 view model 생성
3. iframe에는 `snapshot-restore` 대신 별도 `cpm-hydrate` 메시지로 전달
4. 버전 표시는 snapshot 이름이 아니라 현재 로드 소스와 updated_at 기준으로 표준화

### B. iframe 초기화 단순화
1. `request-db-snapshot`, `patch-custom-fields`, 늦은 상태 주입 의존 제거
2. iframe은 받은 payload만 렌더
3. 로딩 오버레이는 “초기 hydrate 완료 전”에만 표시
4. hydrate 실패 시에만 fallback 처리

### C. 매핑 반영 흐름 재구성
1. `MapTasksDialog` 저장 성공
2. React query invalidate
3. 통합 CPM view model 재생성
4. iframe에 즉시 재전송
5. side panel / task badge / network node / tooltip 동시 갱신

### D. 동기화 강화
1. `cpm_task_mappings` / `cpm_activities` realtime 구독 추가
2. 다른 브라우저/기기 변경 시 현재 세션도 재hydrate
3. debounce로 과도한 전체 재렌더 방지

### E. Snapshot 기능 역할 재정의
1. snapshot은 관리자/PM의 명시적 버전 저장/복원 전용
2. 자동저장은 유지하더라도 “기준 데이터”가 아니라 백업/버전 용도
3. 일반 사용자 화면은 snapshot 최신성 비교 없이 DB 기준으로 로드

---

## 문제별 기대 효과

### 1. 매핑된 태스크 사라짐
- 새로고침해도 DB 기준으로 다시 조립되므로 사라지지 않음
- 일반사용자 매핑도 즉시 반영됨
- 기기 간 동일 상태 보장

### 2. 타 기기 BLDG 미표시
- 최초 payload에 customFields 포함
- patch 후행 방식 제거
- 첫 렌더부터 BLDG 배지/필터/tooltip 정상 표시

### 3. 상태 아이콘 지연 생성
- 최초 hydrate 시 status 포함
- 필터와 무관하게 첫 렌더부터 표시
- 노드/툴팁/상세패널 수치 일치

### 4. 로딩지연/동기화 불일치
- 복원 경로 단순화로 경쟁 조건 감소
- localStorage 우선 복원 제거로 브라우저 편차 감소
- DB 변경 realtime 반영으로 타 브라우저 동기화 강화

---

## 추가로 함께 정리해야 할 항목

1. tooltip의 상태 키가 노드 렌더와 동일한 키 체계를 쓰도록 통일
2. `MapTasksDialog` 접근성 경고(ref, description) 정리
3. `cpm_task_mappings` 권한은 유지하되, 일반사용자 삭제/수정 범위를 명확히 정책화
4. 필요 시 “last synced at” 표시 추가
5. CPM 전체 로딩 상태를 단계별로 표시:
   - activities 로딩
   - mappings/status 계산
   - network 렌더 완료

---

## 변경 범위

### 프론트엔드
- `src/pages/CpmScheduler.tsx`
- `src/components/cpm/ActivityTaskPanel.tsx`
- `src/components/cpm/MapTasksDialog.tsx`
- `public/cpm_network.html`

### 백엔드/데이터 사용 방식
- 기존 테이블 재사용 중심
- 필요 시 realtime 대상 테이블 추가
- 필요 시 snapshot 메타 규칙 정리

---

## 기술 메모

```text
Before
iframe localStorage -> request snapshot -> restore snapshot -> patch customFields -> send status later

After
React load normalized CPM view model from DB
  -> one hydrate message to iframe
  -> iframe renders once
  -> mapping/activity updates trigger rehydrate/realtime sync
```

핵심은 버그별 패치가 아니라,
**“CPM 화면이 어떤 데이터를 정답으로 믿는가”를 다시 정의하는 것**입니다.

이 방향으로 구현하면 현재 3개 문제뿐 아니라,
- 타기기 최초 진입 문제
- 새로고침 후 불일치
- 일반사용자 매핑 반영 문제
- 로딩 경쟁 조건
- 후행 patch 의존성
까지 한 번에 정리할 수 있습니다.
