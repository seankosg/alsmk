

# 대시보드 레이아웃 재배치 + ProjectHUD 헤더 추가

## 변경 내용 (`src/pages/Index.tsx`)

### 1. KUKU CPM 위젯 블록을 MilestoneTimeline과 ProjectHUD 사이로 이동

### 2. ProjectHUD 위에 "Task Status HUD" 헤더 추가
- `text-lg font-semibold text-foreground` — KUKU CPM 위젯 헤더(line 125)와 동일한 스타일

### 변경 후 순서

```text
1. Header + ExportReportDialog
2. MilestoneTimeline
3. KUKU CPM 위젯 헤더 + 새로고침 버튼
4. CpmSummaryBanner
5. KukuProgressOverview | KukuCoverageRate
6. KukuPredecessorWatch | KukuDelayRiskBoard
7. "Task Status HUD" 헤더 (신규)
8. ProjectHUD
9. CategoryProgressChart | TeamProgressChart
10. OverdueTasksBoard | CriticalIssueBoard
11. BehindScheduleBoard | UpcomingDeadlines
12. TeamHeatmap | PartStatusBoard
13. ActivityStream (Admin)
14. PersonnelTable
```

### 파일

| 파일 | 내용 |
|------|------|
| `src/pages/Index.tsx` | JSX 블록 순서 변경 + `<h2>Task Status HUD</h2>` 헤더 추가 |

