

## Plan: Subject와 Start 사이에 Action Plan 컬럼 추가

### 변경 파일
`src/components/tasks/TaskTable.tsx`

### 변경 내용

1. `DEFAULT_COL_WIDTHS`에 `actionPlan: 200` 추가 (subject 다음 위치)
2. 테이블 헤더 배열에서 `subject` 다음, `start` 앞에 `{ key: "actionPlan", label: "Action Plan" }` 추가
3. 테이블 바디에서 해당 위치에 `task.action_plan` 표시하는 `TableCell` 추가 (truncate 적용)
4. `colSpan`을 10 → 11로 변경 (빈 데이터 메시지용)

