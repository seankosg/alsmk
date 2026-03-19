

## Dashboard 카드 재배치 및 Overdue Task 카드 신규 생성

### 현재 레이아웃
```text
Row 1: Behind Schedule | Critical Issues
Row 2: Upcoming Deadlines | Issue Trend
```

### 변경 후 레이아웃
```text
Row 1: Overdue Tasks (신규) | Critical Issues
Row 2: Behind Schedule | Upcoming Deadlines
```

- **Issue Trend 차트**: 삭제 (import 및 컴포넌트 제거)
- **IssueTrendChart.tsx 파일**: 유지 (다른 곳에서 사용 가능성)

### 신규: Overdue Tasks 카드
- **파일**: `src/components/dashboard/OverdueTasksBoard.tsx`
- **조건**: `end_date < today && current_progress < 100`
- **UI**: BehindScheduleBoard와 동일한 패턴 — 팀별 그룹핑, Collapsible, 클릭 시 TaskDetailDialog
- **표시 정보**: task_code, title, assignee, 초과 일수(D+N), progress
- **기존 쿼리 키 재사용**: `["tasks"]`, `["teams"]`, `["members"]`, `["milestones"]`

### 수정 파일
1. **`src/pages/Index.tsx`** — import 변경, 카드 배치 순서 변경
2. **`src/components/dashboard/OverdueTasksBoard.tsx`** — 신규 생성

