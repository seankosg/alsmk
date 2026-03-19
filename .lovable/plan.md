

# Summary Task 자동 생성 기능

## 접근 방식

기존 TaskTable 표시 로직은 변경하지 않습니다. 대신 **"Generate Summary Tasks" 버튼**을 추가하여, 동일 title을 가진 task 그룹에 대해 **실제 DB 행으로 Summary Task를 생성**합니다.

## DB 변경 (Migration)

`tasks` 테이블에 2개 컬럼 추가:

```sql
ALTER TABLE public.tasks ADD COLUMN parent_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN is_summary boolean NOT NULL DEFAULT false;
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
```

- `is_summary = true`: Summary Task (자동 생성된 상위 행)
- `parent_id`: Subtask가 자신의 Summary Task를 참조

## 기능 흐름

1. Workspace 페이지에 **"Generate Summaries"** 버튼 추가 (Admin/PM만 표시)
2. 버튼 클릭 시:
   - 동일 `title`을 가진 task가 2개 이상인 그룹 탐색
   - 해당 그룹에 이미 `is_summary=true`인 Summary가 있으면 **업데이트**, 없으면 **새로 생성**
   - Summary Task 값 계산:
     - **Start**: subtask 중 최소 start_date
     - **End**: subtask 중 최대 end_date
     - **Actual%**: Duration-weighted average (`Σ(actual% × duration) / Σ(duration)`)
     - **Issue Flag**: subtask 중 가장 심각한 플래그 승격
     - **action_plan**: null (Summary이므로)
     - **team_id**: subtask의 team_id (동일 팀이면 해당 팀, 다르면 첫 번째 subtask의 팀)
   - 각 subtask의 `parent_id`를 해당 Summary의 id로 설정
3. 생성 완료 후 task 목록 자동 새로고침

## TaskTable 표시 변경 (최소)

- `is_summary = true`인 행: **볼드 + 배경색 구분** (예: `bg-muted/30`)으로 시각 구분
- Summary 행 클릭 시 TaskDetailDialog는 **readOnly** (자동계산 값이므로)
- 정렬/필터는 기존 로직 그대로 유지 (Summary도 일반 행처럼 표시)

## 변경 파일

| 파일 | 변경 |
|------|------|
| DB Migration | `parent_id`, `is_summary` 컬럼 추가 |
| `src/pages/Workspace.tsx` | "Generate Summaries" 버튼 + 생성 로직 |
| `src/components/tasks/TaskTable.tsx` | Summary 행 스타일링 (볼드/배경색), readOnly 처리 |
| `src/components/tasks/TaskDetailDialog.tsx` | `is_summary` task는 편집 불가 표시 |

## 계산 로직 (MS Project 방식)

```text
duration(t) = end_date - start_date + 1 (calendar days)
Summary Actual% = Σ(subtask.actual% × duration(subtask)) / Σ(duration(subtask))
Summary Plan%  = calcPlannedProgress(summary.start_date, summary.end_date)
```

Summary의 Plan%는 Summary 자체의 start/end 기준으로 기존 `calcPlannedProgress` 함수 사용.

