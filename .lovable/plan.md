
# Actual 100% 완료 태스크에 "Done" 표시

## 원인
현재 D-Day 칼럼은 `actual_finish` 필드가 설정된 경우에만 "Done"을 표시합니다. `current_progress`가 100%여도 `actual_finish`가 null이면 계속 D-Day를 카운트합니다.

## 변경 사항

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/tasks/TaskTable.tsx` | line 604: `actual_finish` 조건에 `current_progress >= 100` 추가 |
| `src/pages/Workspace.tsx` | line 291: 엑셀 Export 시에도 동일하게 `current_progress >= 100` 조건 추가 |

### TaskTable.tsx (line 603-612)
```tsx
// 기존
const remaining = task.actual_finish ? 0 : differenceInCalendarDays(...);
{task.actual_finish ? "Done" : ...}

// 변경
const isDone = !!task.actual_finish || task.current_progress >= 100;
const remaining = isDone ? 0 : differenceInCalendarDays(...);
{isDone ? "Done" : ...}
```

### Workspace.tsx (line 291)
```tsx
// 기존
const dDay = t.actual_finish ? "Done" : ...;

// 변경
const isDone = !!t.actual_finish || t.current_progress >= 100;
const dDay = isDone ? "Done" : ...;
```
