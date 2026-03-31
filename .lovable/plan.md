

# 경과일수 기반 MPP 진행률 자동 업데이트

## 개요

`cpm_activities`의 `start_date`/`finish_date`를 이용하여 경과일수 기반 계획 진행률을 자동 계산하고 `progress` 컬럼에 저장합니다.

**공식**: `progress = min(100, max(0, round((오늘 - start_date + 1) / (finish_date - start_date + 1) × 100)))`

## Auto/Manual 모드

`project_settings` 테이블에 `cpm_progress_mode` 키를 추가하여 모드를 관리합니다:
- **auto** (기본값): CPM 페이지 로드 시(hydration) 모든 activity의 progress를 경과일수 기반으로 자동 갱신
- **manual**: 기존 방식 유지 (XML 값 또는 수동 입력)

Admin/PM만 모드를 전환할 수 있으며, 전환 UI는 SnapshotManager 옆 토글 버튼으로 제공합니다.

## 변경 사항

### 1. `src/hooks/useCpmViewModel.ts`
- `hydrateIframe()` 시작 시 `project_settings`에서 `cpm_progress_mode` 조회
- `auto` 모드이면: 모든 `cpm_activities`에 대해 `start_date`/`finish_date` 기반 progress 계산 → DB batch update → 이후 기존 hydrate 로직 진행
- 계산 함수: `calcElapsedProgress(startDate, finishDate)` — `calcPlannedProgress`와 동일 로직을 activity 날짜에 적용

### 2. `src/lib/mockData.ts`
- `calcPlannedProgress`를 `calcElapsedProgress`로도 재사용 가능하도록 export (이미 동일 로직이므로 별도 함수 불필요, 기존 함수 활용)

### 3. `src/pages/CpmScheduler.tsx`
- Auto/Manual 토글 버튼 추가 (SnapshotManager 옆, Admin/PM 전용)
- 토글 시 `project_settings` upsert (`cpm_progress_mode` = 'auto' | 'manual')
- Auto 모드 활성화 시 즉시 progress 일괄 업데이트 실행 + iframe refreshStatus

### 4. `src/components/cpm/ActivityTaskPanel.tsx`
- Auto 모드일 때 MPP 진행률 옆에 "Auto" 배지 표시
- Auto 모드일 때 수동 편집 버튼(Pencil) 비활성화 (자동 계산값이 우선)

## 자동 업데이트 타이밍

1. **CPM 페이지 진입 시**: hydration 과정에서 auto 모드이면 일괄 갱신
2. **모드 전환 시**: Manual → Auto 전환 즉시 일괄 갱신
3. `start_date`가 없거나 `finish_date`가 없는 activity는 progress를 변경하지 않음 (기존 값 유지)

## 영향 범위

- 네트워크 노드: 매핑 태스크가 없는 노드는 이 자동 계산된 progress가 표시됨
- 대시보드 CPM 위젯 (향후): 이 값을 MPP 계획 진행률로 사용
- 스냅샷: DB progress가 업데이트되므로 다음 스냅샷에 반영

