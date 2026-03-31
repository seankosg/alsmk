

# 기간 가중 평균 진도율 적용

## 개요

모든 대시보드 진도율 계산을 **단순 산술 평균 → 기간(duration) 가중 평균**으로 변경합니다. 동시에 `is_summary` 태스크 필터링 버그도 수정합니다.

## 가중 평균 공식

```text
duration(t) = (end_date - start_date) / 86400000 + 1  (최소 1일)

가중 평균 = Σ(progress × duration) / Σ(duration)
```

## 변경 사항

### 1. `src/lib/mockData.ts` — 유틸 함수 2개 추가

```typescript
export function calcDuration(startDate: string, endDate: string): number { ... }
export function weightedAvg(tasks: any[], valueFn: (t: any) => number): number { ... }
```

### 2. `src/components/dashboard/ProjectHUD.tsx`

- `is_summary` 태스크 제외 (`tasks.filter(t => !t.is_summary)`)
- `avgProgress`, `avgPlanned` 계산을 `weightedAvg()` 사용으로 변경
- KPI 카운트(completed/inProgress/notStarted)도 `nonSummaryTasks` 기준

### 3. `src/components/dashboard/CategoryProgressChart.tsx`

- line 66: `!(t.is_summary && !t.category)` → `!t.is_summary` 로 수정
- line 73-78: 카테고리별 `avgActual`, `avgPlanned`를 `weightedAvg()` 사용

### 4. `src/components/dashboard/TeamProgressChart.tsx`

- line 73-82: 팀별 `avgActual`, `avgPlanned`를 `weightedAvg()` 사용 (이미 `!t.is_summary` 필터 있음)

### 5. `src/lib/dashboardExport.ts`

- Excel Sheet1 Summary: `weightedAvg()` 적용 + `is_summary` 필터
- Excel Sheet3 Team Progress: 동일 적용
- PPT Slide1 KPI: 동일 적용

## 영향 없는 영역

- Behind Schedule / Overdue: 개별 태스크 gap 계산이므로 변경 불필요
- Task Distribution 브래킷: 개별 태스크 분류이므로 변경 불필요

