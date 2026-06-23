## 목표
Summary 페이지의 Block(건물) 목록 순서를 사용자가 지정한 순서로 고정한다.

## 배경
현재 `summaryEngine.ts`는 `mdr_buildings` 테이블의 `sort_order` 값을 기준으로 Block을 정렬한다. DB에 값이 없거나 일치하지 않으면 원하는 순서가 나오지 않는다.

## 변경 범위
- `src/lib/mdr/summaryEngine.ts` — 정렬 로직 1곳만 수정

## 구현 상세
1. `BUILDING_ORDER: string[]` 상수를 추가한다.
   - 순서: `GEN` → `SMP&CCM` → `HSM` → `CRM` → `MAIN_OFFICE` → `FAFP`
   - (사용자 표기: General, SMP, HSM, CRM, Main Office, FAFP)
2. `fetchSummary()` 안 `blocks.sort()`의 첫 번째 기준을 `BUILDING_ORDER` 인덱스 비교로 변경한다.
   - 두 Block 모두 목록에 있으면 인덱스 오름차순
   - 한쪽만 있으면 목록에 있는 쪽이 위로
   - 둘 다 없으면 기존 로직(`inMaster` → `sortOrder` → `buildingWf` → `localeCompare`) 폴백
3. UI 컴포넌트(`MdrSummaryPanel.tsx`)에는 변경 없음.

## 검증
- 브라우저에서 `/design/summary` 진입 시 Block 행이 지정한 순서로 표시되는지 확인.

## 예외 처리
- DB에 존재하지만 `BUILDING_ORDER`에 없는 건물 코드는 기존 정렬 규칙 폴백을 따른다.
- 도면 데이터에만 존재하고 `mdr_buildings`에 없는 건물도 동일하게 폴백 처리.