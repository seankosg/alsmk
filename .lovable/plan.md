

## Assignee 수정 기능 추가

### 변경 파일: `src/components/tasks/TaskDetailDialog.tsx`

**1. 상태 추가**
- `assigneeId` 상태 변수 추가, `useEffect`에서 `task.assignee_id`로 초기화

**2. UI 변경 (line 235-238)**
- 기존 읽기 전용 텍스트를 `Select` 드롭다운으로 교체
- `members` 목록에서 선택 가능, "Unassigned" 옵션 포함
- `readOnly` 시 `disabled`

**3. handleSave 업데이트 (line 140-149)**
- `assignee_id: assigneeId || null` 추가

**4. TaskComments 참조 (line 416)**
- `taskAssigneeId`를 동적 `assigneeId` 상태로 변경

