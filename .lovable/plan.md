

# CPM Summary Banner 구현 계획

## UI 레이아웃

KUKU 섹션 헤더 바로 아래에 단일 Card로 배치. 6개 KPI를 가로 그리드로 표시:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  CPM Summary                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 📊 1,247  │ │ 🔴  89   │ │ 🏗️  156  │ │ 🎯  42   │ │ 🔗 98/156│ │ ⚡Runtime│ │
│ │Total Acts │ │Critical  │ │KUKU Acts │ │Milestones│ │Mapped    │ │Data Src  │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

- 반응형: `lg:grid-cols-6` / `md:grid-cols-3` / `sm:grid-cols-2`
- 각 KPI: Lucide 아이콘 + 큰 숫자 + 작은 라벨
- Critical Path 수가 높으면 빨간 뱃지, Mapped 비율 낮으면 노란 뱃지
- Data Source는 "Runtime" (초록) / "DB" (회색) 뱃지 + 시각 표시

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | 반환값에 `criticalCount`, `milestoneCount`, `dataSource`, `lastSyncTime` 추가 |
| `src/components/dashboard/CpmSummaryBanner.tsx` | 신규 — 6개 KPI 배너 컴포넌트 |
| `src/pages/Index.tsx` | KUKU 헤더 아래에 `<CpmSummaryBanner />` 삽입 |

## 구현 세부

### 1. `useKukuDashboard.ts` 확장
`queryFn` 내에서 이미 `activities` 배열을 순회하므로 추가 DB 호출 없이:
```typescript
criticalCount: activities.filter(a => a.is_critical).length,
milestoneCount: activities.filter(a => a.is_milestone).length,
dataSource: isRuntimeSource ? "runtime" : "db",
lastSyncTime: runtimeCache?.lastSyncTime || null,
```

### 2. `CpmSummaryBanner.tsx` 
- `useKukuDashboard()` 훅에서 데이터 소비
- 6개 KPI를 `Card` 안 그리드로 렌더링
- 로딩 중에는 `Skeleton` 표시
- 데이터 없을 때 "CPM 데이터 없음" 메시지

### 3. `Index.tsx`
KUKU 헤더 + 새로고침 버튼 아래, 첫 번째 위젯 그리드 위에 배치

