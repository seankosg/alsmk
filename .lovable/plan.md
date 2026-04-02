

# 대시보드 2열 위젯 높이 동기화

## 목적
좌우로 나란히 배치된 위젯 쌍의 높이를 동일하게 맞춤 (우측 기준)

## 수정: `src/pages/Index.tsx`

모든 2열 그리드 컨테이너에 CSS Grid의 `items-stretch` (기본값)를 활용하되, 각 자식 위젯의 Card 컴포넌트가 부모 높이를 채우도록 `h-full` 클래스를 적용:

1. 각 `grid` 래퍼의 직계 자식 `div`에 `className="h-full"` 추가
2. 각 위젯 컴포넌트 내부의 최상위 `<Card>`에 `className="h-full flex flex-col"` 적용
3. `<CardContent>` 에 `flex-1 min-h-0` 추가하여 남은 공간을 채우도록 처리

### 대상 위젯 (6개 그리드 행)
- CategoryProgressChart / TeamProgressChart
- OverdueTasksBoard / CriticalIssueBoard
- BehindScheduleBoard / UpcomingDeadlines
- KukuProgressOverview / KukuCoverageRate
- KukuPredecessorWatch / KukuDelayRiskBoard
- TeamHeatmap / PartStatusBoard

### Index.tsx 변경 예시
```tsx
{/* 기존 */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div data-export-id="category-progress">
    <CategoryProgressChart />
  </div>
  <div data-export-id="team-progress">
    <TeamProgressChart />
  </div>
</div>

{/* 변경: 자식에 h-full 추가 (grid items-stretch가 기본이므로 자식이 h-full이면 동일 높이) */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div data-export-id="category-progress" className="h-full">
    <CategoryProgressChart />
  </div>
  <div data-export-id="team-progress" className="h-full">
    <TeamProgressChart />
  </div>
</div>
```

### 각 위젯 컴포넌트 수정
최상위 `<Card>`에 `h-full flex flex-col`, `<CardContent>`에 `flex-1 min-h-0` 추가

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/Index.tsx` | 그리드 자식 div에 h-full 추가 |
| 12개 위젯 컴포넌트 | Card에 h-full flex flex-col, CardContent에 flex-1 |

