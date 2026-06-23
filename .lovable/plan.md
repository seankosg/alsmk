## 목표
Raw Data 그리드의 **Columns** 드롭다운(컬럼 표시 토글)에서:
1. 체크박스를 라벨 옆에 명시적으로 표시 (현재는 shadcn `DropdownMenuCheckboxItem`이 좌측에 indicator만 노출 — 직관성 부족)
2. 항목을 여러 개 연속으로 켜고/끌 수 있도록 토글 시 **메뉴(팝오버)가 닫히지 않게** 유지

## 변경 파일
`src/components/mdr/grid/MdrAdvancedGrid.tsx` (한 파일, 라인 422–440 블록만)

## 구현 방식
- `DropdownMenu` → `Popover`로 교체 (이미 같은 파일/프로젝트 컨벤션, `ColumnFilterDropdown`와 동일한 패턴).
- 각 항목을 `<label>` + shadcn `Checkbox` + 텍스트 구조로 렌더 → 체크박스가 라벨 옆에 보이고, 클릭해도 Popover는 닫히지 않음 (Popover는 외부 클릭/ESC에서만 닫힘).
- 트리거 버튼/아이콘(`Settings2` "Columns")·정렬·`max-h-80 overflow-auto`는 유지.
- 상단에 "전체 선택 / 전체 해제" 보조 버튼 추가(다중 토글 편의 — `ColumnFilterDropdown`과 동일한 UX). `__select__` 컬럼은 기존처럼 제외.
- 사용하지 않게 된 `DropdownMenu*` import 중 이 위치에서만 쓰던 것은 그대로 두되, 다른 사용처가 없으면 정리.

## 동작 변경 없음
- 컬럼 가시성 영속화(`columnVisibility` state·`setPersisted`)는 그대로.
- 헤더 라벨 산출 로직 동일 (`typeof col.columnDef.header === "string" ? ... : col.id`).
