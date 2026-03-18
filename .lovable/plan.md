

## 대시보드 컴포넌트 4개 추가 구현

사용자가 선택한 1, 3, 4, 5번 컴포넌트를 구현합니다.

### 1. Team Progress Bar Chart (`TeamProgressChart.tsx`)
- Recharts `BarChart` 사용, 각 팀(DES, PRO, BUD, CON)별 **계획 진척률 vs 실제 진척률** 비교
- `tasks` + `teams` 테이블에서 팀별 평균 progress 계산
- 계획 진척률은 `calcPlannedProgress` 유틸 사용
- 그라데이션 바, 반투명 계획 바로 시각적 대비

### 3. Upcoming Deadlines (`UpcomingDeadlines.tsx`)
- 7일 이내 마감 태스크 리스트
- `tasks` 테이블에서 `end_date` 기준 필터
- 진척률 < 70%인 항목은 경고 색상 강조
- 남은 일수 표시, Progress bar 포함

### 4. Task Distribution Pie Chart (`TaskDistributionChart.tsx`)
- Recharts `PieChart` (도넛 차트)
- 진척 구간별 분포: 0-25%, 25-50%, 50-75%, 75-100%
- 구간별 색상 코딩 (red → orange → blue → green)

### 5. Issue Trend Chart (`IssueTrendChart.tsx`)
- `activity_log` 테이블에서 issue 관련 액션 추출 또는 `tasks` 테이블의 `created_at` + `issue_flag` 기반
- 최근 8주간 주별 critical/warning 이슈 발생 빈도
- Recharts `BarChart` (stacked) 사용

### Dashboard Layout 변경 (`Index.tsx`)
현재 레이아웃에 4개 컴포넌트 추가:

```text
[Milestone Timeline]
[Project HUD - 5 cards]
[TeamProgressChart | CriticalIssueBoard]  ← 1번이 TeamHeatmap 대체
[TaskDistributionChart | UpcomingDeadlines]  ← 새 행
[IssueTrendChart | ActivityStream]  ← 새 행
[PersonnelTable]
```

### 디자인 방향
- 기존 Card 스타일 유지 (dark mode 지원)
- `font-mono` 숫자, `text-xs`/`text-sm` 라벨
- 차트 색상: primary(blue), success(green), warning(orange), destructive(red) CSS 변수 활용
- 로딩 시 Skeleton 표시

### 파일 변경
- **신규**: `src/components/dashboard/TeamProgressChart.tsx`
- **신규**: `src/components/dashboard/UpcomingDeadlines.tsx`
- **신규**: `src/components/dashboard/TaskDistributionChart.tsx`
- **신규**: `src/components/dashboard/IssueTrendChart.tsx`
- **수정**: `src/pages/Index.tsx` — 새 컴포넌트 import 및 레이아웃 배치

