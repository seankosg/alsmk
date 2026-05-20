## 판단
이번 `tasks_task_code_key` 충돌은 **같은 계열의 재발**이지만, 단순히 재정렬 함수만의 문제가 아닙니다.
원인은 두 가지 구조가 함께 남아 있었기 때문입니다:
1. **Soft delete된 subtask가 기존 `task_code`를 계속 점유** → 새 subtask 코드 발급/재정렬을 막음
2. **Subtask INSERT가 재정렬보다 먼저 실행** → 중간 단계에서 UNIQUE 충돌 가능

여기에 더해, subtask 삭제 시 Summary 진행률이 **삭제된 row까지 포함하거나 잘못된 시점에 재계산**되는 문제도 같이 정리합니다.

## 구현 계획

### 1. Task Code UNIQUE 제약을 부분 인덱스로 전환
- 기존 `tasks_task_code_key`(전체 UNIQUE)를 제거하고
- **`deleted_at IS NULL`인 행에만 적용되는 Partial Unique Index**로 교체
- 결과: soft delete된 task의 코드가 새 코드 발급을 더 이상 막지 않음 (48시간 복원 정책은 그대로 유지)

### 2. `generate_task_code()` 보강
- subtask 분기에서 sibling count를 **`deleted_at IS NULL` 조건으로 필터**
- 삭제된 형제가 보유한 코드와 새 코드가 동일해도, 1번의 partial index 덕분에 충돌 없음

### 3. `resequence_subtask_codes()` 유지 + 호출 시점 단순화
- 함수 자체는 이미 2-pass 구조로 안전 → 그대로 유지
- 다만 프론트에서 호출되는 흐름을 단일 RPC로 통합 (아래 4번)

### 4. Subtask 추가를 단일 트랜잭션 RPC로 묶기
- 새 RPC `add_subtask(_parent_id, payload)`를 만들어 다음을 한 번에 처리:
  - parent가 아직 summary가 아니면 summary로 전환 + 원본 데이터를 첫 subtask로 복제
  - 새 subtask insert
  - `resequence_subtask_codes(_parent_id)` 호출
- 프론트 `AddSubtaskDialog.tsx`는 이 RPC만 호출하도록 단순화

### 5. Summary 재계산 트리거 조건 수정 (요청사항 반영)
현재 `update_summary_progress` 트리거는 `AFTER INSERT/UPDATE/DELETE`에서 모두 발화하며, 집계 시 `deleted_at` 필터가 일관되지 않게 적용되어 있어 다음 문제가 생깁니다:
- subtask **soft delete (UPDATE deleted_at)** 시 trigger가 발화되지만, 집계 SELECT에 `deleted_at IS NULL`이 빠진 경로가 있어 삭제된 row가 포함되어 진행률이 변형됨
- subtask **복원(UPDATE deleted_at → NULL)** 시에도 동일하게 잘못된 평균이 다시 계산됨
- subtask **hard delete (TG_OP = DELETE)** 시에는 OLD row 기준으로 재계산이 일어나 일시적으로 잘못된 값이 저장됨

수정 내용:
- 집계 쿼리 **모든 경로에 `deleted_at IS NULL` 강제 적용**
- 트리거 조건을 좁혀, `deleted_at` 컬럼 변경 시에도 정상적으로 한 번만 재계산되도록 정리
- 활성 subtask가 0개가 되는 경우(전부 삭제) summary 진행률/날짜를 **변경하지 않음** → 사용자가 복원할 때 원본 값 보존
- 진행률 계산은 Core 메모리 규칙대로 **Duration-Weighted Average**: `Σ(progress × duration) / Σ(duration)` 유지

### 6. 복원 경로 안전장치
- `DeletedTasksList.handleRestore`: 복원 시 동일 부모 아래에 같은 코드가 이미 있으면 자동으로 `resequence_subtask_codes(parent_id)` 호출하여 코드 재배열
- 일반 task/summary 복원 시 코드 충돌은 partial index로 더 이상 발생하지 않음

## 영향 파일
- **DB migration**:
  - `tasks_task_code_key` 제거 + `idx_tasks_task_code_active` partial unique index 생성
  - `generate_task_code()`: subtask 분기에 deleted_at 필터 추가
  - `update_summary_progress()`: 집계 필터/트리거 조건 정리 + 활성 subtask 0개 보호
  - 신규 `add_subtask(_parent_id uuid, ...)` RPC
- **Frontend**:
  - `src/components/tasks/AddSubtaskDialog.tsx`: 단일 RPC 호출로 단순화
  - `src/components/tasks/DeletedTasksList.tsx`: subtask 복원 시 재정렬 호출 추가

## 기대 결과
- Summary 상세 패널에서 subtask 추가 시 `tasks_task_code_key` 충돌이 재발하지 않음
- 삭제 이력이 있는 부모 아래에서도 정상 추가 가능
- subtask **soft delete/복원** 시 Summary 진행률·날짜가 의도치 않게 변형되지 않음
- 48시간 soft delete 정책과 휴지통 복원 기능은 그대로 유지