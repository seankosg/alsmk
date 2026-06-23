## 목적
`exportIssues.ts`의 엑셀 다운로드에서 **중복 시트**와 **파싱 오류 시트** 두 시트 모두 동일한 컬럼 순서로 재배치합니다.

## 새 컬럼 순서 (양 시트 공통)

| # | 헤더 | 비고 |
|---|---|---|
| 1 | Sheet | source_sheet |
| 2 | Excel Row# | raw_row_no (현재 행) |
| 3 | Duplicated Excel Row# | 이 행이 중복으로 판정된 **원본 행 번호** |
| 4 | Source No. | source_no |
| 5 | Doc No. | doc_base |
| 6 | Rev. | rev (사용자 요청: 유지) |
| 7 | Title | drawing_title |
| 8 | Reason | reason |

> Item No 컬럼은 제외 (사용자가 명시한 순서에 없음).

## Duplicated Excel Row# 값 산출 방법
- 중복 시트의 reason 문자열은 importRunner에서 이미 `파일 내 중복 (원본 Row #N)` 또는 `파일 내 중복 (원본 SHEET!Row #N)` 형태로 기록되어 있음.
- exportIssues.ts에서 정규식 `/Row #(\d+)/`로 N을 추출하여 해당 컬럼에 숫자로 표시.
- 파싱 오류 시트의 행은 이 컬럼이 공란(중복이 아님).

## 파싱 오류 시트 구조 변경
- 기존: `구분 / 위치 / 내용` 3컬럼 → 신규: 위 8컬럼 동일 구조.
- 행 매핑:
  - **Batch Error**: Sheet 이하 전부 공란, Reason 컬럼에 `[Batch Error] ${error_summary}` 표기.
  - **Row Error**: IssueRowLog 필드를 그대로 매핑. Duplicated Excel Row#는 공란.

## 변경 파일
- `src/lib/mdr/exportIssues.ts`
  - `dupCols` 및 `errCols` 정의를 위 8컬럼으로 재정의 (alignment/width 조정).
  - 중복 시트 행 매핑에 `parseDuplicatedRowNo(reason)` 헬퍼 추가.
  - 파싱 오류 시트 행 매핑을 새 컬럼 구조로 재구성.
  - 헤더 라벨: `Doc No.`, `Rev.`, `Excel Row#`, `Duplicated Excel Row#`, `Source No.` (사용자 표기 그대로).

## 영향 범위
- 프론트엔드 다운로드 로직만 수정. DB/RPC/타입 변경 없음.
- 기존 배치도 reason 텍스트에서 원본 행 번호를 그대로 추출 가능.
