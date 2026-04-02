

# CPM Summary Banner 개선

## 변경 내용

### 1. `src/components/dashboard/CpmSummaryBanner.tsx`

**Data Source 카드 제거 → 헤더로 이동**
- 6번째 KpiBox (Zap 아이콘, Runtime/DB 뱃지) 삭제
- "CPM Summary" 텍스트 옆에 `text-muted-foreground/50` 스타일로 `· Runtime` 또는 `· DB` 표시

**6번째 자리에 복합 KPI 카드 추가**
- 하나의 KpiBox 크기 안에 3개 미니 지표를 세로로 배치:
  - **Delayed**: `kukuActivities` 중 `progress < plannedProgress - 5` 인 건수 (빨간색)
  - **Pred Alerts**: `predecessors` 중 `gap < -5` 인 건수 (주황색)
  - **Gap**: 전체 KUKU 가중평균 (actual - planned) % (음수면 빨간, 양수면 초록)

**아이콘·라벨 크기 확대**
- 아이콘: `h-4 w-4` → `h-5 w-5`
- 라벨 텍스트: `text-[11px]` → `text-xs`
- 값 텍스트: `text-xl` → `text-2xl`

### 2. `src/hooks/useKukuDashboard.ts`
- 변경 불필요 — `kukuActivities`의 `progress`, `plannedProgress`와 `predecessors`의 `gap` 값이 이미 반환되므로 컴포넌트에서 직접 계산

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/CpmSummaryBanner.tsx` | Data Source 카드 제거, 복합 KPI 카드 추가, 크기 확대, 헤더에 소스명 표시 |

