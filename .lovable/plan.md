## A. 사이드바 메뉴 순서 변경 (소규모)

`src/components/layout/AppSidebar.tsx`에서 평면 항목과 Collapsible 그룹의 출력 순서를 재배열합니다. 현재는 모든 평면 항목을 먼저 `map`으로 렌더하고 마지막에 Design Management Collapsible을 붙이는 구조라, **Project Dashboard 직후에 Design Management가 끼어들도록** 렌더 로직을 단일 통합 리스트로 바꿉니다.

### 변경 방식
- `allNavItems` 배열의 순서를 다음과 같이 재정의:
  1. Project Dashboard (`/`)
  2. **(여기에 Design Management Collapsible 슬롯)** — 배열에 `{ type: "design-group" }` 센티넬 항목 삽입
  3. CPM Manager (`/cpm`)
  4. My Dashboard (`/my`)
  5. My Workspace (`/workspace`)
  6. Calendar (`/calendar`)
  7. Messages (`/messages`)
  8. Organization (`/organization`)
  9. Admin (`/admin`)
  10. Import (`/tasks/import`)
- 렌더 루프(`navItems.map`)에서 `item.type === "design-group"`이면 **isAdminOrPm일 때만** 기존 Collapsible 블록을 출력, 평면 항목이면 기존 `SidebarMenuButton/NavLink`를 출력.
- Collapsible을 평면 항목 map 뒤에 따로 두던 분기(현재 121~159라인)는 제거.
- 권한 필터(`navItems.filter`) 로직은 그대로 유지하되 sentinel은 필터링에서 제외.

### 영향 파일
- `src/components/layout/AppSidebar.tsx` (한 파일만)

---

## B. SHAW Defect Raw Data → MDR Raw Data 그리드 이식

`src/components/mdr/MdrRawDataGrid.tsx`의 단순 HTML `<table>`을 SHAW PROJECT CMS의 `DefectRawDataPage`에서 사용하는 **@tanstack/react-table + react-virtual 기반 고급 그리드**로 교체하고, 선택된 행을 일괄 편집하는 **Bulk Action Bar**를 함께 추가합니다. SHAW 측은 defect 도메인 전용 인프라(change-log 테이블, RPC, 분류 캐시, 코멘트, 마스터 데이터 등)와 강결합되어 있으므로, MDR(`mdr_drawings`) 도메인 크기에 맞춰 **필요한 부분만 적응 포팅**합니다.

### B1. 의존성 추가
```text
@tanstack/react-table
@tanstack/react-virtual
```
(현재는 `@tanstack/react-query`만 설치)

### B2. 신규 파일 구조
```text
src/components/mdr/grid/
├── MdrAdvancedGrid.tsx           (메인 그리드 — 기존 MdrRawDataGrid 대체)
├── columns.tsx                   (ColumnDef<MdrDrawingRow>[] 빌더)
├── filterFns.ts                  (multiSelect/text/dateRange/progress filter fn)
├── ColumnFilterDropdown.tsx      (Multi/Text/DateRange 3종 통합 Popover)
├── TopHorizontalScrollbar.tsx    (SHAW 그대로 포팅, 의존성 없음)
├── MdrBulkActionBar.tsx          (Bulk 편집 도구모음 — MDR 간소화 버전)
└── useGridStatePersistence.ts    (localStorage 영속화 훅)

src/lib/mdr/
└── bulkEdit.ts                   (BulkEditableField 정의 + applyMdrBulkUpdate)

src/components/mdr/MdrRawDataGrid.tsx   (얇은 re-export → 외부 import 경로 유지)
```

### B3. 컬럼 정의 (`columns.tsx`)
MDR 도메인 컬럼을 `ColumnDef<MdrDrawingRow>[]`로 구성:

| 그룹       | 컬럼 키 / 표시                                | 필터          | 정렬 | 비고            |
| ---------- | --------------------------------------------- | ------------- | ---- | --------------- |
| 선택       | `__select__` (Checkbox)                       | —             | —    | 좌측 sticky     |
| 식별       | source_no, building_code, item_no, discipline | multi-select  | ✓    | sticky 후보     |
| 도면       | drawing_title                                 | text(AND)     | ✓    | truncate        |
| 단계 마크 | SD/DD/CD 유무                                 | multi-select  | —    |                 |
| DD 셀     | DD30/60/90/100 P/A/Δ                          | —             | —    | `stageCell()`   |
| CD 셀     | CD30/60/100 P/A/Δ                             | —             | —    | `stageCell()`   |
| 진행       | DD%, CD%, Overall%                            | progress      | ✓    |                 |
| 일정       | plan_finish                                   | date-range    | ✓    |                 |
| 메타       | updated_at                                    | date-range    | ✓    |                 |

색상은 기존 `deltaCls(delta)` 규칙을 그대로 유지 (threshold prop 사용).

### B4. 그리드 기능
- `useReactTable` + `getCoreRowModel / getFilteredRowModel / getSortedRowModel / getFacetedRowModel / getFacetedUniqueValues`
- `useVirtualizer` (estimateSize 32px) — 500+ 행 가상화
- 컬럼 리사이즈 (`enableColumnResizing`, 헤더 우측 핸들)
- 컬럼 가시성 토글 (`DropdownMenu` 체크리스트)
- 좌측 고정 컬럼: 선택 + source_no + item_no (sticky)
- 상단 미러 가로 스크롤바 (`TopHorizontalScrollbar`)
- 전역 검색 인풋 (디바운스 200ms, MDR 텍스트 필드 OR)
- 필터 칩 영역 (현재 활성 필터 X로 제거 가능)
- 상태 영속화 키: `mdr-raw-grid-state:{user.id}:{buildingCode}:{sheetName ?? "all"}`
  - 저장 대상: `sorting`, `columnFilters`, `columnSizing`, `columnVisibility`
  - `rowSelection`은 세션 한정 (저장 안 함)

### B5. 필터 동작 (`filterFns.ts`)
- `multiSelectFilterFn` — `(Empty)` 토큰(`__EMPTY__`) 지원
- `textFilterFn` — 쉼표(`,`) AND 토큰
- `dateRangeFilterFn` — from/to/emptyOnly
- `progressFilterFn` — `formatPct` 매칭

### B6. 데이터 흐름
- 기존 `useQuery(["mdr_drawings", buildingCode, sheetName])` 호출 유지
- 행 가공(`stageCell`, `overall` 등)은 `useMemo`로 단 한 번 수행

### B7. Bulk Action Bar (`MdrBulkActionBar.tsx`)
선택된 행이 1개 이상일 때 그리드 상단에 sticky로 표시.

편집 가능 필드 (`MDR_BULK_FIELDS`):
```ts
[
  { field: "discipline",    label: "Discipline",    inputType: "select",
    options: ["A","S","M","E","P","C","I"].map(v=>({value:v,label:v})), group: "분류" },
  { field: "plan_finish",   label: "Plan Finish",   inputType: "date",   group: "일정" },
  { field: "drawing_title", label: "Drawing Title", inputType: "text",   group: "내용" },
]
```

UI 구성:
- 선택 카운트 칩 (`N selected`)
- 필드 선택 `Select` (group 라벨 포함)
- 값 입력 컨트롤 (select | date | text) + **Blank 체크박스** (NULL로 클리어)
- **Apply** 버튼 → 확인 `Dialog`(첫 5행 before/after 미리보기, 총 영향 행 수, 500행 배치 안내) → 실행
- 보조 액션:
  - **Export selected → .xlsx** (xlsx 동적 import, 현재 visible 컬럼 순서)
  - **Copy as TSV** (`navigator.clipboard.writeText`)
  - **Clear selection** (X 아이콘)
- 권한 게이트: `useAuthContext().isAdminOrPm === false`면 도구모음 자체 비표시 (Guest/ReadOnly 차단)

### B8. 일괄 업데이트 (`bulkEdit.ts`)
```ts
applyMdrBulkUpdate({ ids, field, value, userId }): Promise<{ok:number; failed:number}>
```
동작:
- 500행씩 청크 분할 (`BULK_CHUNK_ROWS = 500`)
- `supabase.from("mdr_drawings").update({ [field]: value, updated_by: userId }).in("id", chunk).select("id")`
- 변경 로그 테이블이 없으므로 `activity_log`에 **batch당 1행 요약**만 기록:
  - `entity_type: "mdr_drawings"`, `action: "bulk_edit"`, `metadata: { field, value, count, sample_ids: ids.slice(0,50) }`
- 완료 후 `queryClient.invalidateQueries(["mdr_drawings"])`로 그리드 재조회
- `useToast`로 결과 알림 (성공/부분/실패)

### B9. 이식 제외 항목 (SHAW 전용)
다음은 본 프로젝트에 없는 도메인/인프라이므로 이식하지 않습니다:
- `BulkDuplicateDialog` / `BulkReassignDialog` / `BulkDeleteDialog` — defect 마스터 데이터(서브콘 등) 필요
- `defect-cache`, `useDefectFieldConfig`, `MetaCell`, 코멘트 컬럼 — MDR엔 댓글 시스템 없음
- `getEditableScopeMap`, `is_admin_or_superuser` RPC — 본 프로젝트는 `isAdminOrPm` 기반 단일 게이트
- Critical Issue Board, Subcontractor별 export — 도메인 미존재
- change-log 테이블 기반 diff 로깅 — `activity_log` 요약 1행으로 대체

추후 필요해지면 별도 작업으로 진행.

---

## 검증 절차
1. 빌드/타입체크 통과
2. 사이드바: Admin/PM 계정에서 순서가 Project Dashboard → Design Management → CPM Manager → My Dashboard → My Workspace 순으로 노출되는지 확인. Guest/SuperGuest에서 Design Management 비표시 유지 확인.
3. MDR 그리드: 500+ 더미 행으로 가상 스크롤·필터·정렬·리사이즈·가시성 토글·상단 스크롤바 동기화·localStorage 영속화 점검
4. Admin 계정으로 행 5개 선택 → discipline 일괄 변경 → 그리드 재조회 반영 + activity_log 1행 적재 확인
5. Guest 계정으로 그리드 진입 → Bulk Action Bar 비표시 확인

## 영향 파일 요약
- 신규: `src/components/mdr/grid/*` (7개), `src/lib/mdr/bulkEdit.ts`
- 교체: `src/components/mdr/MdrRawDataGrid.tsx` (얇은 re-export로 단순화)
- 수정: `src/components/layout/AppSidebar.tsx` (메뉴 순서)
- `package.json` 의존성 2종 추가
