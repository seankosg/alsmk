

## 태스크 코멘트 알림 확장 + 코멘트 표시 아이콘

### 1. 모든 코멘트 유형에 알림 발송

**파일**: `src/components/tasks/TaskComments.tsx`

현재 `commentType === "instruction"`일 때만 알림을 보내는 조건을 모든 유형(comment, instruction, reply)으로 확장합니다.

- 알림 조건: `taskAssigneeId`가 존재하고, 본인이 아닌 경우
- 타입별 title 구분:
  - `comment` → "New comment from {name}"
  - `instruction` → "New instruction from {name}"  
  - `reply` → "New reply from {name}"
- 기존 `if (commentType === "instruction" && ...)` 조건에서 `commentType` 체크 제거

### 2. 태스크 테이블에 코멘트 아이콘/뱃지 표시

**파일**: `src/components/tasks/TaskTable.tsx`

태스크별 코멘트 수를 조회하여 Subject 컬럼 옆에 말풍선 아이콘 + 숫자 뱃지로 표시합니다.

- `task_comments` 테이블에서 각 task_id별 count를 한 번에 조회하는 쿼리 추가
- Subject 셀에 `MessageSquare` 아이콘 + 코멘트 수 뱃지 (0이면 미표시)
- instruction 타입이 포함된 경우 아이콘 색상을 info 색으로 강조
- Tooltip으로 "N comments (M instructions)" 표시

### 수정 범위
- `TaskComments.tsx`: 알림 발송 조건 1줄 수정 + title 분기 (~5줄)
- `TaskTable.tsx`: 코멘트 수 쿼리 추가 (~15줄) + Subject 셀 UI 변경 (~10줄)

