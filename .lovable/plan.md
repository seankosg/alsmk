

# Summary Task 기능 종합 계획

## 개요

Summary Task 계층 구조를 완성하고, 일반 사용자도 본인 태스크 범위 내에서 Summary를 생성할 수 있도록 하는 종합 계획.

## 1. DB 트리거 수정 (Migration)

`generate_task_code()` 함수를 수정하여 계층적 코드 생성:

```text
Summary/독립 task: {TeamCode}-{PartCode}-{YYMM}-{0001}
Subtask:           {부모코드}-01, {부모코드}-02, ...
```

- `parent_id IS NOT NULL`인 경우: 부모의 `task_code` 조회 → 기존 형제 subtask 수 + 1 → `-XX` 번호 부여
- 그 외: 기존 시퀀스 로직 유지

## 2. Generate Summaries 로직 (`Workspace.tsx`)

### 권한별 범위 제한

| 역할 | 대상 범위 |
|------|----------|
| Admin | 전체 프로젝트의 모든 태스크 |
| PM | 전체 프로젝트의 모든 태스크 |
| 일반 사용자 | `assignee_id === memberId`인 본인 태스크만 |

- 일반 사용자: 본인 태스크 중 동일 title이 2개 이상인 그룹만 Summary 생성
- 생성된 Summary의 `assignee_id`는 null (Summary는 개인 소유가 아님)
- Summary INSERT 시 `part_id: groupTasks[0].part_id` 추가 (subtask의 파트 코드 계승)
- Summary 생성 후 subtask들의 `task_code`를 `{summaryCode}-XX` 형식으로 업데이트

### "Generate Summaries" 버튼

- 현재: Admin/PM만 보임
- 변경: 모든 사용자에게 표시. 일반 사용자는 버튼 라벨에 "(내 태스크)" 표시

## 3. TaskTable 정렬 및 시각 표현 (`TaskTable.tsx`)

### 정렬

- 기본 정렬을 `task_code` ASC로 변경 → Summary 코드가 prefix이므로 subtask가 바로 아래 배치
- 필터링 시 Summary의 subtask가 보이면 해당 Summary도 자동 포함 (고아 subtask 방지)

### MS Project 스타일 시각 차별화 (배지 제거)

| 요소 | Summary 행 | Subtask 행 (parent_id 있음) | 독립 Task |
|------|-----------|---------------------------|----------|
| 배경 | `bg-muted/30` | 기본 | 기본 |
| 글자 | `font-semibold text-[15px]` | `text-sm` | `text-sm` |
| Subject 들여쓰기 | 없음 | `pl-6` (왼쪽 패딩) | 없음 |
| Summary 배지 | **제거** | — | — |

## 4. Summary Task 삭제 (`TaskDetailDialog.tsx`)

현재 `readOnly` 조건: `is_summary === true` → 전체 readOnly (삭제 불가)

변경:
- Summary task: 필드 편집은 여전히 readOnly (자동 계산값)
- 삭제 버튼만 별도 활성화 (Admin/PM/일반 사용자 모두 가능, 단 일반 사용자는 본인이 assignee인 subtask로 구성된 Summary만)
- 삭제 시: 하위 subtask들의 `parent_id` → null, `task_code` 유지 (독립 task로 전환)
- 삭제 확인 메시지에 "하위 N개 subtask는 독립 task로 전환됩니다" 안내

## 5. 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| DB Migration | `generate_task_code()` 트리거: subtask 코드 로직 추가 |
| `src/pages/Workspace.tsx` | 범위 제한 로직, `part_id` 추가, subtask 코드 재설정, 버튼 모든 사용자 표시 |
| `src/components/tasks/TaskTable.tsx` | 기본정렬 `task_code` ASC, 들여쓰기, 글자크기 차별화, Summary 배지 제거, Summary 포함 필터 |
| `src/components/tasks/TaskDetailDialog.tsx` | Summary 삭제 허용 (readOnly에서 삭제버튼만 분리), 삭제 시 subtask 독립화 |

