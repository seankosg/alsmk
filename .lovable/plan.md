
점검 결과, 이번 건의 직접 원인은 Summary 롤업 수식이 다시 틀린 것이 아니라, `/workspace`가 재계산 이전의 `tasks` 데이터를 그대로 들고 있는 상태입니다.

## 결론

DES-ARC-2603-0022의 현재 정상값은 아래입니다.

- Actual: 70%
- Plan: 65%
- Gap: +5%

따라서 화면에 보이는 `실제 51 / 계획 65 / Gap -14`는 현재 DB 기준 값이 아니라, 재계산 전 캐시된 값입니다.

## 확인 근거

### 1) 현재 DB 상태
Summary `DES-ARC-2603-0022`의 현재 DB 값:
- `current_progress = 70`
- `updated_at = 2026-04-01 07:05:07+00`

즉, 백엔드에는 이미 70%가 반영되어 있습니다.

### 2) 현재 롤업 계산
삭제되지 않은 하위 subtask만 기준으로 계산하면:

```text
-01: actual 74, planned 69, duration 51
-02: actual 91, planned 86, duration 36
-04: actual  0, planned  0, duration  1
-05: actual  0, planned  0, duration  1
-06: actual  0, planned  0, duration 12
(-03은 deleted_at 존재 → 제외)
```

계산식:

```text
Actual
= round((74×51 + 91×36 + 0×1 + 0×1 + 0×12) / (51+36+1+1+12))
= round(7050 / 101)
= 70

Plan
= round((69×51 + 86×36 + 0×1 + 0×1 + 0×12) / 101)
= round(6615 / 101)
= 65

Gap
= 70 - 65
= +5
```

## 왜 화면은 아직 51 / 65 / -14 인가

현재 preview에서 확인된 `tasks` 요청 시각:
- `2026-04-01 07:04:08Z`

Summary 재계산 반영 시각:
- `2026-04-01 07:05:07Z`

즉 순서가 이렇습니다:

```text
1. Workspace가 tasks 목록을 먼저 로드함 (옛 값 51 포함)
2. 그 후 Summary 재계산이 DB에 반영됨 (70으로 변경)
3. 하지만 화면의 tasks 쿼리는 자동 재조회되지 않음
4. 그래서 old actual 51 + new plan logic 65 조합처럼 보임
```

## 기술적 원인

### 코드상 상태
- `src/components/tasks/TaskTable.tsx`
  - Summary Plan은 이미 하위 subtask 가중 평균으로 계산됨
  - Actual은 `task.current_progress`를 그대로 표시함
- `src/App.tsx`
  - React Query 기본값이 `staleTime: 30_000`
  - `refetchOnWindowFocus: false`
- `TaskTable`에는 `tasks` 테이블용 realtime invalidate가 없음
  - 댓글만 realtime invalidate 중
  - 따라서 DB에서 값이 바뀌어도 현재 열린 Workspace는 계속 오래된 `tasks` 배열을 유지할 수 있음

## 수정 계획

### 1. Workspace의 tasks 데이터 자동 동기화 보강
- `public.tasks` 변경 시 `["tasks"]` 쿼리를 invalidate하는 realtime subscription 추가
- 대상 이벤트: insert / update / delete

### 2. 수동 확인 없이 최신값 보이게 보완
- Workspace 진입 시 강제 refetch 또는
- 최소한 새로 포커스될 때 refetch 되도록 보강

### 3. 별도 일관성 점검 대상
이번 `51/65/-14`의 직접 원인은 stale cache이지만, 아래 화면은 별도 보정이 필요합니다.
- `src/components/tasks/TaskDetailDialog.tsx`
- `src/pages/Workspace.tsx` export 로직

이 둘은 Summary planned를 아직 Summary 전체 기간 기준으로 계산하고 있어, 메인 테이블과 수치가 다를 수 있습니다.

## 정리
이번 이슈의 핵심은:
- 롤업 수식 문제 재발이 아니라
- Summary 재계산 후 Workspace가 `tasks`를 다시 가져오지 않은 것

따라서 우선 수정해야 할 것은 `tasks` 쿼리의 동기화 방식입니다.
