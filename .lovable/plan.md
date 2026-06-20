## 문제

Raw Data 그리드의 행 순서가 문자열 사전식으로 정렬되어 있어 No.가 `1 → 10 → 100 → 101 → 102 → … → 2` 같은 부자연스러운 순서로 나옵니다 (스크린샷 확인).

원인:

- `MdrAdvancedGrid.tsx`의 Supabase 쿼리가 `.order("discipline").order("source_no")`로 텍스트 컬럼을 ASCII 정렬
- `source_no`, `item_no`는 `"1"`, `"10"`, `"100"`처럼 숫자 문자열 또는 `"SMP&CCM-ARCH-1"`, `"SMP&CCM-ARCH-100"` 같은 혼합 문자열 → 자연 정렬 필요
- TanStack table의 기본 정렬도 문자열이라, 헤더 클릭으로 정렬해도 동일하게 사전식

## 변경

### 1. `src/components/mdr/grid/MdrAdvancedGrid.tsx`

- Supabase `.order("source_no")` 제거 (DB 정렬 의존 X)
- `rows` 생성 후 클라이언트에서 자연 정렬:
  - 1차: `discipline` (A, C, E, I, M, P, S 알파벳)
  - 2차: `source_no`를 `localeCompare(b, undefined, { numeric: true, sensitivity: "base" })`로 비교
- 헤더 클릭 시 사용자 정렬은 그대로 유지(이미 `sorting` 상태 존재)

### 2. `src/components/mdr/grid/columns.tsx`

숫자/혼합 문자열 컬럼에 자연 정렬 sortingFn 적용:

- 공용 함수 `naturalSort(a, b)` 정의: `String(a).localeCompare(String(b), undefined, { numeric: true })`
- 적용 컬럼:
  - `source_no` (No.)
  - `item_no` (Item No., 예: `SMP&CCM-ARCH-1` ~ `ARCH-100`)
  - `building_code` — 영문 그대로지만 일관성 위해 동일 적용
- 각 ColumnDef에 `sortingFn: naturalSort` 추가
- 마일스톤 P/A/Δ 컬럼은 숫자값이므로 기본 sortingFn(alphanumeric)에서 동작하지만, `accessorFn`이 `null`을 반환할 수 있어 `sortUndefined: "last"` 옵션 추가 → 빈 셀이 항상 아래로

## 비범위

- DB 스키마, source_no 정규화 등은 변경하지 않음
- 컬럼 순서/표시(이전 작업)는 유지
