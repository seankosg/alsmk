## 목적
Import Row Details 화면에서 **중복(Skipped Duplicate)** 행과 **파싱 오류(batch error_summary + skipped sheets)** 를 한 번에 Excel로 다운로드합니다.

## UI 변경
`src/pages/DesignImportLogs.tsx` Row Details 헤더 우측에 **"Excel 다운로드"** 버튼 추가 (Download 아이콘 + outline 스타일). selectedBatch 가 있을 때만 노출.

## 파일명 규칙
`{원본파일명(확장자제외)}_import-issues_{YYYYMMDD-HHmm}.xlsx`
예) `02_SMP&CCM_MDR progress_import-issues_20260623-1015.xlsx`

## 엑셀 구조 (2개 시트)

### Sheet 1: `중복 (Duplicate)`
컬럼: Row #, Sheet, Doc No (base), Item No, Source No, Title, Reason
- 데이터: `rowLogs.filter(action === "skipped_duplicate")`
- 정렬: Sheet → Row # 오름차순

### Sheet 2: `파싱 오류 (Parse Errors)`
컬럼: 구분, 위치, 내용
- 행 1: 배치 전체 `error_summary` (있을 때, 구분="Batch Error")
- 행 N: `mdr_import_row_logs` 중 reason에 "오류"·"error"·"failed" 패턴 매칭되는 행 (구분="Row Error", 위치=`{sheet}!Row #{row}`)
- 비어있어도 헤더는 출력

## 시인성 디자인 (xlsx 라이브러리 cell style)
- **헤더 행**:
  - 배경 `#1E3A8A` (deep blue), 글자 `#FFFFFF`, Bold, 가운데정렬, 높이 28px
  - 하단 굵은 테두리
- **데이터 행**:
  - 폰트 11pt, 세로 가운데, 가로 좌측 (Row #·Source No 는 우측 정렬)
  - 짝수 행 옅은 회색 `#F8FAFC` (zebra)
  - 모든 셀에 얇은 테두리 (`#E2E8F0`)
- **컬럼 폭** (문자 단위):
  - Row # = 8, Sheet = 12, Doc No = 32, Item No = 22, Source No = 12, Title = 60, Reason = 50
  - Sheet 2: 구분 14, 위치 22, 내용 90
- **첫 행 고정** (Freeze pane: A2)
- **자동 필터** 헤더에 적용

## 구현 세부
- 라이브러리: 이미 사용 중인 `xlsx` (SheetJS). Pro 스타일은 SheetJS Community에서 제한적이라, **`xlsx-js-style`** 패키지를 추가 의존성으로 도입 (cell style 지원). 또는 기존 `xlsx`를 유지하고 `!cols`, `!rows`, `!autofilter`, `!freeze` 만 사용하고 cell `s` 속성으로 스타일을 부여 — `xlsx-js-style`이 안정적이라 이쪽 권장.
- 새 헬퍼: `src/lib/mdr/exportIssues.ts` — `exportImportIssues(batch, rowLogs)` 함수 export.
- DesignImportLogs.tsx 에서 버튼 onClick 시 헬퍼 호출 → `XLSX.writeFile`.

## 데이터 변경 / DB 마이그레이션
없음. 클라이언트 측 export 만 추가.
