## 변경 목적
`MdrSummaryFilterBar`(Building/Team/Discipline 탭 필터)를 **SUMMARY 테이블에서 떼어내** 마일스톤 모니터링 테이블에 적용한다. SUMMARY 패널은 필터 도입 이전 상태로 원복.

## 작업 범위

### 1. `src/components/mdr/MdrSummaryPanel.tsx`
- `MdrSummaryFilterBar` import/렌더/필터 상태/`filterSummary` 호출 등 필터 관련 코드 전부 제거.
- 전체 데이터(`useMdrSummary` 결과) 그대로 3-level(Block→Team→Discipline) 렌더.
- URL 파라미터 `?b=&t=&d=` 읽기 코드 제거.

### 2. `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- `MdrSummaryFilterBar` import 후 카드 헤더(타이틀/툴바) 바로 위 또는 아래에 렌더.
- `useState<SummaryFilterState>` 로 필터 상태 보유 + `useSearchParams` 로 `?b=&t=&d=` 동기화 (deep-link).
- `buildings` prop = `matrix.buildings` (또는 `Array.from(new Set(matrix.rows.map(r=>r.building)))`).
- **필터 적용**: 렌더 전에 `matrix.rows`를 다음 조건으로 필터링.
  - `filter.building !== 'all'` → `row.building === filter.building`
  - `filter.team !== 'all'` → `TEAM_OF_DISCIPLINE[normalizeDiscipline(row.discipline)] === filter.team`
  - `filter.discipline !== 'all'` → `normalizeDiscipline(row.discipline) === filter.discipline`
  - 모두 AND.
- 필터링된 `displayRows` 기준으로 `blockRowSpan` (동일 building 카운트) 재계산.
- `headers`/`lastMsByStage`/`expanded` 등 마일스톤 컬럼 로직은 변경 없음 (모든 마일스톤 열은 유지).
- 결과가 0행이면 "필터 조건에 해당하는 행이 없습니다." placeholder 표시.

### 3. (선택) FAFP 행 처리
- DB에 잔존하는 원본 `FAFP` discipline 행은 `normalizeDiscipline` 후에도 `FAFP`로 유지될 수 있음 → Team 필터(Mech/Elec) 적용 시 매칭되지 않아 숨겨짐. 이 동작이 기본이며 별도 처리하지 않음 (FAFP는 신규 임포트 시 FP/FA로 분리되도록 이미 normalize에서 처리됨).

## 기술 메모
- `MdrSummaryFilterBar.tsx` / `weights.ts` 변경 없음 (재사용).
- 모니터링의 snapshot 저장/재계산 로직 영향 없음. 필터는 클라이언트 표시 전용.
- URL 키는 SUMMARY에서 쓰던 `b/t/d` 그대로 사용 (페이지 내 동일 키 재사용으로 충돌 없음).
