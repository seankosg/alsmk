

# KUKU Predecessor Watch — 완료일 기준 지연일수 표시

## 변경 내용

### 1. `src/hooks/useKukuDashboard.ts`

**PredecessorInfo 인터페이스에 필드 추가** (line 33 근처):
```typescript
finish_date: string | null;
delayDays: number | null;  // 오늘 - finish_date (양수면 지연)
```

**predInfos.push 로직에 값 추가** (line 241~252):
- `finish_date: predAct.finish_date`
- `delayDays`: `finish_date`가 있고 오늘보다 과거이면 `Math.floor((today - finishDate) / 86400000)`, 아니면 `null`

### 2. `src/components/dashboard/KukuPredecessorWatch.tsx`

**우측 정보 영역에 지연일수 표시** (line 57~63):
- 기존 Actual/Plan/Gap 아래에 `delayDays > 0`이면 빨간색으로 `D+{일수}` 표시
- `delayDays`가 null이거나 0 이하이면 표시하지 않음

```text
기존:          추가 후:
Actual 45%     Actual 45%
Plan 70%       Plan 70%
-25%p          -25%p
               D+12
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | `PredecessorInfo`에 `finish_date`, `delayDays` 추가 |
| `src/components/dashboard/KukuPredecessorWatch.tsx` | 지연일수 `D+N` 표시 |

