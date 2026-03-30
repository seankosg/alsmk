

# Category Progress 드릴다운 다이얼로그 — action_plan 표시 추가

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/dashboard/CategoryProgressChart.tsx` | 드릴다운 다이얼로그의 태스크 카드를 다른 대시보드 패널과 동일한 레이아웃으로 변경 |

## 변경 내용 (lines 206-216)

현재 카드 내부 구조:
1. task_code + issue_flag
2. title (truncate)
3. assignee

변경 후 (Behind Schedule 등과 동일):
1. task_code + issue_flag
2. title + assignee (같은 행, justify-between)
3. action_plan (별도 행, `text-[11px] text-muted-foreground line-clamp-2`)
4. Progress bar (`h-1.5`) + actual% 텍스트

Progress bar도 추가하여 다른 패널과 완전히 통일합니다.

