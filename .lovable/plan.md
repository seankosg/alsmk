

# Team Progress 차트 — 지연 태스크 수 배지 추가

## 변경 파일: `src/components/dashboard/TeamProgressChart.tsx`

### 1. chartData에 `behindCount` 추가 (lines 79-98)

팀/개인 chartData 계산 시 `gap < 0`인 태스크 수를 `behindCount`로 추가:

```typescript
const behindCount = teamTasks.filter(t => 
  t.current_progress - calcPlannedProgress(t.start_date, t.end_date) < 0
).length;
return { name, planned, actual, gap, id, fullName, behindCount };
```

### 2. `renderActualLabel` 수정 (lines 122-137)

현재 구조 (위→아래): gap 텍스트 → actual% 값

변경 후 (위→아래):
- **지연 배지** `▼3` (빨간색, behindCount > 0일 때만)
- **gap 텍스트** `+2%p` 또는 `-5%p`
- **actual% 값** `56%`

```text
    ▼3        ← 빨간 배지 (y - 34)
   -5%p       ← gap (y - 20)
    56%       ← actual (y - 6)
```

margin top을 35→45로 조정하여 3줄이 바 위에 충분히 표시되도록 함.

### 3. 타입 업데이트

chartData 타입에 `behindCount: number` 추가 (individualChartData의 filter 타입 포함).

