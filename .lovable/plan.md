

# ActivityTaskPanel에 3단 레이어 진행바 추가

## 변경 내용 (`src/components/cpm/ActivityTaskPanel.tsx`)

Status 아이콘 블록(line 576) 바로 아래, Key metrics(line 579) 위에 3단 레이어 진행바를 삽입합니다.

### 추가할 JSX (line 577 부근)

```tsx
{/* 3-layer progress bar: planned (gray) → actual (blue) → gap (red) */}
{mappedTasks.length > 0 && (
  <div className="space-y-1 px-1">
    <div className="relative h-3 w-full rounded-full overflow-hidden bg-[#555]">
      {/* Planned (gray) — full width as background */}
      <div
        className="absolute inset-y-0 left-0 bg-primary rounded-full"
        style={{ width: `${overallStats.actual}%` }}
      />
      {overallStats.gap < 0 && (
        <div
          className="absolute inset-y-0 bg-destructive rounded-r-full"
          style={{
            left: `${overallStats.actual}%`,
            width: `${Math.min(Math.abs(overallStats.gap), overallStats.planned - overallStats.actual)}%`,
          }}
        />
      )}
    </div>
    <div className="flex justify-between text-[10px] font-mono">
      <span className="text-muted-foreground">계획 {overallStats.planned}%</span>
      <span className="text-primary">실적 {overallStats.actual}%</span>
      <span className={overallStats.gap >= 0 ? 'text-success' : 'text-destructive'}>
        GAP {overallStats.gap > 0 ? '+' : ''}{overallStats.gap}%
      </span>
    </div>
  </div>
)}
```

### 시각 구조
```text
[■■■■■■■■■■■▒▒▒▒░░░░░░░░░░░░░░░]
 ← actual(blue) →← gap(red) →← planned remainder(gray #555) →
계획 45%              실적 35%              GAP -10%
```

- 회색(`#555`): 배경 = planned 전체 범위
- 파란색(`primary`): actual 진행률
- 빨간색(`destructive`): gap (actual < planned일 때만 표시)

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/cpm/ActivityTaskPanel.tsx` | Status 아이콘 아래에 3단 진행바 + 라벨 추가 (~15줄) |

