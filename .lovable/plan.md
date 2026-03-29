

# 매핑된 Task 사라짐 — 근본 원인 분석 결과

## 발견된 원인 3가지

### 원인 1: `upsertActivities` 의 orphan 삭제 로직 (주요 원인)

`cpm-calculated` 이벤트가 발생할 때마다 `upsertActivities`가 실행됩니다 (admin/PM만). 이 함수는:

1. iframe의 `activities` 배열을 DB에 upsert
2. DB에 있지만 iframe에 없는 activity를 "orphan"으로 판정
3. orphan 중 매핑이 없으면 → **자동 삭제**
4. orphan 중 이름이 같은 새 activity가 있으면 → **매핑 이전 후 삭제**

**문제**: `cpm-hydrate` 수신 시 iframe이 `calculate(true)`를 호출 → `postCpmCalculated()` 발생 → parent가 `upsertActivities` 실행. 이 시점에 iframe의 `activities` 배열이 스냅샷 복원 직후라 **customFields 패치 전 상태**일 수 있고, 만약 스냅샷 데이터가 불완전하면 일부 activity가 누락되어 정상 activity가 orphan으로 잘못 판정 → **매핑과 함께 삭제**됩니다.

특히 `mpp_task_id`나 `wbs_full`이 null인 activity는 `validKeys` Set에 포함되지 않으므로(`filter((a) => a.mppTaskId && a.wbsFull)`, line 93-94), orphan 검사에서도 제외되긴 하지만, DB 쪽 orphan 검사(`line 110`)에서도 null이면 제외하므로 이 부분은 안전합니다.

**하지만 핵심 문제는**: 매 `calculate()` 호출마다 orphan 검사가 실행되므로, 스냅샷 데이터와 DB 데이터가 미세하게 다르면 (예: 이전 버전 스냅샷이 복원된 경우) **정상 activity가 orphan으로 잘못 삭제**됩니다.

### 원인 2: MapActivitiesDialog의 delete-then-insert 패턴

`MapActivitiesDialog.tsx` (Task → Activity 매핑, line 91):
```typescript
await supabase.from("cpm_task_mappings").delete().eq("task_id", taskId);
// Insert new
```

`MapTasksDialog.tsx` (Activity → Task 매핑, line 99):
```typescript
await supabase.from("cpm_task_mappings").delete().eq("activity_id", activityId);
// Insert new
```

**경쟁 조건**: 두 사용자가 동시에 매핑하면, User A의 delete가 User B가 방금 insert한 행을 삭제할 수 있습니다. 특히 MapActivitiesDialog는 `task_id` 기준으로 삭제하므로, 다른 activity에 대한 같은 task의 매핑도 날아갑니다.

### 원인 3: 새 XML 업로드 시 orphan 자동 삭제

새 XML을 업로드하면 activity 목록이 완전히 바뀌고, 이전 activity들이 모두 orphan으로 판정됩니다. 매핑이 없는 orphan은 **확인 없이 자동 삭제**됩니다 (line 148-157).

## 수정 계획

### 1. orphan 삭제를 새 XML 업로드 시에만 실행 (핵심 수정)

현재는 매 `cpm-calculated` 이벤트마다 orphan 검사가 실행됩니다. 이를 **새 XML 파싱 후에만** 실행하도록 변경합니다.

**방법**: iframe이 `cpm-calculated` 메시지에 `isNewImport: true` 플래그를 추가. parent는 이 플래그가 있을 때만 orphan 로직을 실행.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | `postCpmCalculated()`에 `isNewImport` 플래그 추가. XML 파싱 후 calculate 시에만 true |
| `src/pages/CpmScheduler.tsx` | `upsertActivities`를 2개로 분리: 일반 upsert (orphan 검사 없음) + XML import upsert (orphan 검사 포함) |

### 2. delete-then-insert를 트랜잭션으로 보호

MapTasksDialog와 MapActivitiesDialog의 delete → insert 사이에 다른 사용자의 작업이 끼어들 수 있는 경쟁 조건을 해결합니다.

**방법**: RPC 함수로 원자적 매핑 업데이트 구현.

| 파일 | 변경 |
|------|------|
| DB migration | `upsert_activity_mappings(activity_id, task_ids[])` 및 `upsert_task_mappings(task_id, activity_ids[])` RPC 함수 생성 |
| `src/components/cpm/MapTasksDialog.tsx` | delete+insert → RPC 호출로 변경 |
| `src/components/cpm/MapActivitiesDialog.tsx` | delete+insert → RPC 호출로 변경 |

### 3. hydrate 시 calculate의 postCpmCalculated 억제

`cpm-hydrate` 수신 후 `calculate(true)` 호출 시 `postCpmCalculated()`가 실행되어 불필요한 upsert를 트리거합니다. 이를 억제합니다.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | hydrate 복원 시 `_suppressPost = true` 플래그 설정. `postCpmCalculated()`와 `postSnapshotSave()`에서 이 플래그 체크 후 스킵 |

## 변경 요약

| # | 파일 | 목적 |
|---|------|------|
| 1 | DB migration | 원자적 매핑 RPC 함수 2개 |
| 2 | `public/cpm_network.html` | `isNewImport` 플래그 + hydrate 시 post 억제 |
| 3 | `src/pages/CpmScheduler.tsx` | orphan 로직을 XML import 시에만 실행 |
| 4 | `src/components/cpm/MapTasksDialog.tsx` | RPC 호출로 변경 |
| 5 | `src/components/cpm/MapActivitiesDialog.tsx` | RPC 호출로 변경 |

