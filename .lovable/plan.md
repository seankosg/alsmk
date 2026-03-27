

# 진행율 색상 통일 — 앱 전체 적용

## 색상 규칙

| 항목 | 색상 | CSS 토큰 |
|------|------|----------|
| 계획 (Planned) | 회색 | `muted-foreground` |
| 실적 (Actual) | 파란색 | `primary` |
| 차이 (Gap) ≥ 0 (달성/초과) | 초록색 | `success` |
| 차이 (Gap) < 0 (미달) | 빨간색 | `destructive` |

핵심 변경: **Gap의 3단계 색상(success/warning/destructive)을 2단계(success/destructive)로 단순화**. 또한 계획을 amber/warning 대신 gray로 통일.

## 변경 파일 및 내용

### 1. `src/components/dashboard/ProjectHUD.tsx`
- 계획 도넛 색상: `hsl(38, 90%, 50%)` (amber) → `hsl(var(--muted-foreground))` (gray)
- 범례 Plan 색상: amber → muted-foreground
- Gap 색상: 이미 success/destructive로 정상

### 2. `src/components/dashboard/TeamProgressChart.tsx`
- chartConfig planned 색상: 이미 muted-foreground ✅
- chartConfig actual 색상: 이미 primary ✅
- gap 색상: 이미 success/destructive ✅
- Actual bar가 미달일 때 destructive로 칠하는 로직: 유지 (실적 바 자체를 빨간색으로 → **파란색(primary) 유지로 변경**, gap 텍스트에서만 빨간색 표시)

### 3. `src/components/dashboard/CategoryProgressChart.tsx`
- 동일하게 Actual bar 미달 시 destructive → primary로 통일 (bar 자체는 항상 파란색, gap 텍스트만 빨강/초록)

### 4. `src/components/dashboard/TeamHeatmap.tsx`
- `getGapColor`: 3단계(success/warning/destructive) → 2단계(success/destructive)

### 5. `src/components/cpm/ActivityTaskPanel.tsx`
- `GapBadge`: warning 중간단계 제거, gap ≥ 0이면 success, < 0이면 destructive
- `overallStats.gap` 표시: warning 제거, 2단계로 단순화
- 개별 task gap 표시: 동일하게 2단계

### 6. `src/pages/MyDashboard.tsx`
- Avg Planned 카드: 현재 기본색 → `text-muted-foreground` 명시
- Avg Actual 카드: 현재 기본색 → `text-primary` 명시
- Gap 카드: 이미 success/destructive ✅ (0일 때만 muted → success로 변경)

### 7. `src/lib/dashboardExport.ts`
- PPTX 내보내기에서 Avg Plan 색상: AMBER → GRAY (`999999`)
- Avg Actual 색상: BLUE ✅
- Gap 색상: GREEN/RED ✅

### 8. `src/components/dashboard/BehindScheduleBoard.tsx`
- gap 표시 색상 확인 및 통일 (warning → destructive로 변경 if applicable)

## 요약

총 8개 파일에서 진행율 관련 색상을 **계획=회색, 실적=파란색, 차이=초록/빨강** 2단계로 통일합니다. 기존의 amber/warning 중간 단계를 제거하여 일관된 시각 언어를 적용합니다.

