

# KUKU 중심 CPM 대시보드 위젯 구현

## 개요

건축사업본부(KUKU) 중심의 CPM 연계 위젯 4개를 프로젝트 대시보드(Index 페이지)에 추가합니다. 데이터 소스는 `cpm_activities` 테이블의 `custom_fields->Text1 = 'KUKU'`로 필터링합니다.

## 위젯 구성

### 1. KUKU Activity Progress Overview
- **파일**: `src/components/dashboard/KukuProgressOverview.tsx`
- KUKU 액티비티 전체 요약: 총 개수, 완료(100%), 진행중, 미시작(0%), 크리티컬 패스 개수
- 가중 평균 진행률 (duration 기반) vs MPP 경과일수 기반 계획 진행률 비교
- 수평 progress bar로 Actual vs Planned 시각화

### 2. KUKU Predecessor Watch
- **파일**: `src/components/dashboard/KukuPredecessorWatch.tsx`
- KUKU 액티비티의 선행(predecessor) 중 **타 파티**(Text1 ≠ KUKU) 액티비티 목록
- 선행 데이터: `cpm_snapshots`의 snapshot data에서 predecessor 관계를 추출
- 각 선행 액티비티의 progress vs 경과일수 기반 계획 진행률, gap 표시
- 지연(gap < -5%) 항목은 빨간 강조, 정상은 녹색

### 3. KUKU Delay Risk Board
- **파일**: `src/components/dashboard/KukuDelayRiskBoard.tsx`  
- KUKU 액티비티 중 progress < 계획 진행률 - 5%인 지연 항목 리스트
- 매핑된 태스크가 있으면 태스크 가중 평균 actual vs planned 표시
- 매핑 없으면 MPP progress vs 경과일수 계획 비교
- gap% 내림차순 정렬, critical path 항목에 CP 배지

### 4. KUKU Coverage Rate
- **파일**: `src/components/dashboard/KukuCoverageRate.tsx`
- KUKU 액티비티 중 태스크 매핑이 있는 비율 (매핑 커버리지)
- 도넛 차트: 매핑됨 vs 미매핑
- 미매핑 액티비티 목록 (WBS, 이름) — 클릭 시 CPM 페이지로 이동

## 데이터 조회 전략

모든 위젯이 동일한 데이터셋을 사용하므로 **공통 커스텀 훅** `src/hooks/useKukuDashboard.ts`를 생성:
- `cpm_activities` (custom_fields, progress, duration, start_date, finish_date, is_critical, mpp_task_id)
- `cpm_task_mappings` (activity_id, task_id)
- `tasks` (current_progress, start_date, end_date) — 매핑된 태스크만
- `cpm_snapshots` (latest, predecessor 관계 추출용)
- React Query `queryKey: ["kuku-dashboard"]`, staleTime 30초

## 대시보드 배치 (Index.tsx)

Behind Schedule/Upcoming Deadlines 아래, Team Heatmap 위에 배치:

```text
[KUKU Progress Overview]  [KUKU Coverage Rate]     ← 2-col grid
[KUKU Predecessor Watch]  [KUKU Delay Risk Board]  ← 2-col grid
```

## 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | 신규 — 공통 데이터 훅 |
| `src/components/dashboard/KukuProgressOverview.tsx` | 신규 |
| `src/components/dashboard/KukuPredecessorWatch.tsx` | 신규 |
| `src/components/dashboard/KukuDelayRiskBoard.tsx` | 신규 |
| `src/components/dashboard/KukuCoverageRate.tsx` | 신규 |
| `src/pages/Index.tsx` | 위젯 4개 import + 배치 추가 |

