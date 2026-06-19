## 변경 사항

### 1. 건물명 파서 로직 수정 (`src/lib/mdr/parser.ts`)
현재 `extractBuildingFromFilename`은 `_`로 split 후 **마지막 토큰**을 사용 → `"02_SMP&CCM_MDR PROGRESS"` → `"PROGRESS"`로 잘못 추출됨.

**새 규칙**: 파일명 규약 `{NN}_{BUILDING}_MDR PROGRESS...`
- 정규식: `/^\d+[_\s-]+(.+?)[_\s-]+MDR/i` → 1번 캡처 그룹이 건물명
- `MAIN OFFICE` 같은 공백 포함 케이스도 처리하기 위해, MDR 키워드 앞까지를 모두 건물명으로 잡되 마지막 1개 토큰만 사용
  - `01_GEN_MDR progress` → `GEN`
  - `02_SMP&CCM_MDR PROGRESS` → `SMP&CCM`
  - `03_HSM_MDR progress` → `HSM`
  - `04_CRM_MDR PROGRESS` → `CRM`
  - `05_MAIN OFFICE_MDR PROGRESS` → `MAIN` (요구사항: MAIN OFFICE가 아니라 **MAIN**)
- MDR 키워드를 못 찾으면 폴백: 두 번째 `_` 토큰 사용
- `00_..._SUMMARY` 패턴은 기존 `isSummaryFilename` 그대로 유지

`MAIN OFFICE` → `MAIN` 처리: 매칭된 건물명 문자열의 첫 단어(공백 split 첫 토큰)만 채택해 대문자화.

### 2. Raw Data 탭: 시트(분야)별 서브탭 자동 생성
현재 구조: `건물 탭` 1단 → 격자에 모든 분야 혼합 표시.

신규 구조: `건물 탭` → 내부에 **시트명(=Discipline) 서브탭** (ARCH / STR / MECH / ELEC 등).
- `src/pages/DesignManagement.tsx`의 Raw Data `TabsContent`에서 건물 선택 시, 해당 건물의 `mdr_drawings.source_sheet` distinct 목록 쿼리 → 서브 `Tabs` 렌더.
- `MdrRawDataGrid`에 `sheetName?: string` prop 추가 → 있으면 `eq("source_sheet", sheetName)` 필터.
- 서브탭은 기존 시트 순서(파서가 본 순서)를 유지하기 위해 `mdr_drawings.source_sheet`를 distinct + `min(created_at)` 기준 정렬.

### 3. Dashboard / Summary 탭 → 사이드바 이전
현재: `/design` 페이지 내부 4탭(Dashboard / Summary / Raw Data / Admin).

신규 라우팅:
- `/design` — Raw Data + Admin 2탭만 유지 (기본 Raw Data)
- `/design/dashboard` — `DesignDashboard.tsx` 신규 페이지 (Phase 2 placeholder 그대로)
- `/design/summary` — `DesignSummary.tsx` 신규 페이지 (`MdrSummaryPanel` 그대로 사용)

사이드바 (`src/components/layout/AppSidebar.tsx`):
- 기존 단일 "Design Management" 항목을 **그룹**으로 확장 (Admin/PM 전용 유지):
  - Design Management (그룹 라벨)
    - Dashboard → `/design/dashboard`
    - Summary → `/design/summary`
    - Raw Data → `/design`
- 활성 라우트는 `pathname.startsWith('/design')`로 그룹 펼침 유지.

App.tsx 라우트 추가:
- `<Route path="/design/dashboard" element={<DesignDashboard />} />`
- `<Route path="/design/summary" element={<DesignSummary />} />`

### 4. DesignManagement 페이지 헤더 정리
- 4탭 → 2탭 (`Raw Data`, `Admin`).
- 페이지 상단 Import 버튼/asOf/Δ 임계 입력은 Raw Data 탭에서만 의미 있으므로 유지.

## 영향 받는 파일
- 수정: `src/lib/mdr/parser.ts`, `src/pages/DesignManagement.tsx`, `src/components/mdr/MdrRawDataGrid.tsx`, `src/components/layout/AppSidebar.tsx`, `src/App.tsx`
- 신규: `src/pages/DesignDashboard.tsx`, `src/pages/DesignSummary.tsx`

## 마이그레이션 / 기존 데이터
- DB 변경 없음.
- **기존 임포트된 건물 행 중 잘못된 건물명(`PROGRESS` 등)이 있다면** 사용자가 Admin에서 수동 정리하거나, 재임포트로 정상 건물명이 새로 INSERT됨. 기존 잘못된 행 자동 삭제는 하지 않음(앱-마스터 정책 준수). 필요 시 별도 요청으로 정리 마이그레이션 제공 가능.
