

# Workspace Excel Export 전면 재검토 및 수정

## 현재 문제점

### 1. Type 구분 로직 결함
현재 코드 (line 250):
```javascript
isSummary ? "Summary" : (t as any).parent_id ? "  └ Subtask" : "Task"
```
- `is_summary=true` → Summary
- `parent_id`가 있음 → Subtask
- 나머지 → Task

**문제**: Export는 `tasks` 배열을 flat하게 순회하므로 Summary 밑에 Subtask가 연속 배치되지 않음. TaskTable은 `grouped` 로직으로 부모-자식 순서를 보장하지만, Export는 DB 정렬(`title, start_date, end_date`) 그대로 출력.

### 2. Task Code 누락
`task_code` 컬럼이 Export에 포함되지 않음.

### 3. Comments 누락
`task_comments` 데이터가 Export에 포함되지 않음.

### 4. Action Plan 누락 가능성
Summary 태스크는 `action_plan`이 `null`로 설정됨 (Generate Summaries에서 의도적). Export에서 `t.action_plan ?? ""`로 처리하므로 빈 문자열 출력 — **이것은 정상 동작**. 단, 개별 Task의 action_plan이 누락되는 경우는 없어야 함.

### 5. 정렬 불일치
TaskTable은 Summary → Subtask 계층 구조로 표시하지만, Export는 계층 무시하고 flat 정렬.

## 수정 계획: `src/pages/Workspace.tsx` — `handleExport` 함수

### 변경 사항

1. **`handleExport`를 `async`로 변경** — comments fetch 필요

2. **계층 정렬 적용**: TaskTable의 `grouped` 로직과 동일하게 Summary → Subtask 순서 보장
   - Summary/독립 Task를 task_code 순 정렬
   - 각 Summary 아래에 해당 Subtask를 task_code 순 삽입

3. **Task Code 컬럼 추가**: Type 다음에 배치

4. **Comments 컬럼 추가**: `task_comments` 테이블에서 전체 fetch → task별로 `"작성자 (날짜): 메시지"` 형태로 줄바꿈 연결

5. **Export row 구조**:
```
Type | Task Code | Assignee | Category | Subject | Action Plan | Start | Finish | D-Day | Plan % | Actual % | 차이 % | Actual Finish | Comments
```

6. **Export 버튼에 로딩 상태 추가** (async 전환에 따른 UX)

## Type 정의 (명확화)

| 조건 | Type 값 |
|------|---------|
| `is_summary = true` | Summary |
| `parent_id != null` (부모가 Summary) | └ Subtask |
| `is_summary = false` AND `parent_id = null` | Task |

이 정의는 현재 코드와 동일하며 정확합니다. 문제는 Type 구분이 아니라 **정렬 순서**입니다.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/Workspace.tsx` | `handleExport` async 전환, 계층 정렬, task_code·comments 컬럼 추가, 로딩 state |

