

# 단독 태스크에서 서브태스크 추가 기능

## 개요
단독 태스크(is_summary=false, parent_id=null)를 선택했을 때, 해당 태스크를 Summary로 자동 전환하고 서브태스크를 추가할 수 있는 기능 구현.

## 변경 파일

### 1. `src/components/tasks/TaskDetailDialog.tsx`
- **"Add Subtask" 버튼 추가**: 단독 태스크(is_summary=false, parent_id=null)의 상세 다이얼로그 footer에 버튼 표시
- 클릭 시 `AddSubtaskDialog` 열기

### 2. `src/components/tasks/AddSubtaskDialog.tsx` (새 파일)
- 부모 태스크의 값(category, title, team_id, part_id, assignee_id, start_date, end_date)을 복사하여 폼 초기값으로 설정
- action_plan은 빈값으로 시작 (서브태스크마다 다른 작업 내용)
- 사용자가 각 필드를 편집 가능
- task_code는 DB 트리거(`generate_task_code`)가 `parent_id` 기반으로 자동 생성

**저장 시 로직**:
1. 부모 태스크가 아직 `is_summary=false`이면 → `is_summary=true`로 업데이트
2. 새 서브태스크를 `parent_id = 부모.id`로 INSERT
3. 기존 부모 태스크 자체도 첫 번째 서브태스크로 복제 (원본 데이터 보존) — 단, 이미 is_summary=true이면 스킵
4. tasks 쿼리 invalidate

**전환 흐름**:
```text
[단독 Task A] (is_summary=false, parent_id=null)
    ↓ "Add Subtask" 클릭
[Summary Task A] (is_summary=true)  ← 원본이 Summary로 전환
  └ [Subtask A-01]                   ← 원본 데이터 복제
  └ [Subtask A-02]                   ← 새로 추가한 서브태스크
```

### 3. `src/components/tasks/TaskTable.tsx`
- 우클릭 컨텍스트 메뉴 또는 행 내 아이콘 대신, 기존 `TaskDetailDialog`를 통해 접근하므로 변경 최소화
- `TaskDetailDialog`에 `onAddSubtask` 콜백 전달 불필요 — dialog 내부에서 직접 처리

## 구현 순서

| 단계 | 내용 |
|------|------|
| 1 | `AddSubtaskDialog.tsx` 생성 — 부모 태스크 값 복사 폼 + 저장 로직 |
| 2 | `TaskDetailDialog.tsx`에 "Add Subtask" 버튼 추가 (단독 태스크 + 비-readOnly 조건) |
| 3 | 저장 시 부모 is_summary 전환 + 원본 데이터 서브태스크 복제 로직 |

## 주요 고려사항
- task_code는 DB 트리거가 parent_id 기반으로 자동 생성하므로 클라이언트에서 별도 처리 불필요
- Summary 전환 시 원본 태스크의 action_plan, current_progress 등을 첫 서브태스크로 복제하여 데이터 손실 방지
- 이미 Summary인 태스크에서도 추가 서브태스크 생성 가능하도록 버튼 조건 확장

