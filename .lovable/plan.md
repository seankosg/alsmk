

# Milestone Timeline — 균등 배치 + 구간별 진행바

## 개념

```text
마일스톤:  M1        M2        M3        M4
배치:      0%     33.3%     66.7%     100%   ← 균등 (N-1 구간)

진행바:    |===▌     |         |         |
           구간1     구간2     구간3
           30일      10일      50일      ← 실제 일수 다름

오늘이 M1~M2 구간의 15일째라면:
  → 구간1의 50% 지점 = 전체 33.3% × 0.5 = 16.7% 위치
```

- 마일스톤 아이콘은 **균등 배치** (시인성 우선)
- 진행바는 오늘이 속한 구간까지의 **실제 일수 비율**로 계산

## 변경 내용 (`src/components/dashboard/MilestoneTimeline.tsx`)

### 1. 마일스톤 위치: 균등 배치
```typescript
// 기존 dateToPercent 제거
// 마일스톤 i의 위치 = i / (N-1) * 100
const msPosition = (index: number) => {
  if (milestones.length <= 1) return 50;
  return (index / (milestones.length - 1)) * 100;
};
```

### 2. 진행바 위치: 구간별 일수 비율 보간
```typescript
const elapsedPercent = useMemo(() => {
  if (milestones.length === 0) return 0;
  const dates = milestones.map(ms => parseLocalDate(ms.target_date));
  if (today <= dates[0]) return 0;
  if (today >= dates[dates.length - 1]) return 100;

  // 오늘이 속한 구간 찾기
  for (let i = 1; i < dates.length; i++) {
    if (today <= dates[i]) {
      const segDays = Math.max(differenceInDays(dates[i], dates[i-1]), 1);
      const elapsed = differenceInDays(today, dates[i-1]);
      const ratio = elapsed / segDays;
      const leftPos = msPosition(i-1);
      const rightPos = msPosition(i);
      return leftPos + (rightPos - leftPos) * ratio;
    }
  }
  return 100;
}, [milestones, today]);
```

### 3. 렌더링 적용
- 마일스톤 `left: ${pct}%` → `left: ${msPosition(index)}%`
- Today 마커도 동일한 `elapsedPercent` 사용 (변경 없음)

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/MilestoneTimeline.tsx` | `dateToPercent` → 균등 배치 + 구간별 보간 진행바 |

