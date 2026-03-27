

# Behind Schedule 태스크 표시를 Upcoming Deadlines 스타일로 통일

## 현재 차이점

| 요소 | Behind Schedule | Upcoming Deadlines |
|------|----------------|-------------------|
| 레이아웃 | task_code → title → assignee (3줄) | teamCode · task_code → title + action_plan + assignee (2줄) + progress bar |
| Progress bar | 없음 | 있음 (h-1.5) |
| action_plan | 표시 안 함 | title 옆에 truncate로 표시 |
| assignee | 별도 줄 | title과 같은 줄 우측 |
| 우측 정보 | gap% + Plan/Actual 텍스트 | D-N (남은 일수) |
| 카드 border | 없음 (bg-muted/30) | border + 조건부 warning 배경 |

## 변경: `src/components/dashboard/BehindScheduleBoard.tsx`

Collapsible 내부의 각 태스크 카드를 Upcoming Deadlines와 동일한 구조로 변경:

1. **카드 스타일**: `rounded-lg border p-3` + 조건부 `border-destructive/40 bg-destructive/5` (gap < -10일 때)
2. **1행**: `teamCode · task_code` + issue_flag 배지
3. **2행**: title (truncate, max-w-[40%]) + action_plan (truncate) + assignee (우측)
4. **3행**: Progress bar (h-1.5, `[&>div]:bg-primary`) + actual% 텍스트
5. **우측**: gap% (destructive 색상) + Plan/Actual 소텍스트 유지 (Behind Schedule 고유 정보)

팀 그룹 Collapsible 구조는 유지합니다. `getTeamCode` 헬퍼를 추가하여 task_code 앞에 팀 코드를 표시합니다.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/BehindScheduleBoard.tsx` | 태스크 카드 내부 레이아웃을 Upcoming Deadlines 스타일로 재구성, Progress bar 추가, action_plan 표시 |

