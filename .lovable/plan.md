## 목적
임포트 후 "Skipped (중복)"으로 분류된 행에 대해, **어떤 원본 행과 중복되는지** 를 Row Details 화면에서 확인할 수 있도록 표시합니다.

현재는 중복 행의 Reason 컬럼에 "파일 내 중복 (Doc No.)" 라고만 표기되어, 동일 Doc No.를 처음 차지한 원본 행 번호를 알 수 없습니다.

## 변경 사항

### 1. `src/lib/mdr/importRunner.ts`
- 중복 판정 로직(`for (const r of allRows)` 루프)에서 `seenDocBase`를 `Set` 대신 `Map<docBase, { row: number; sheet: string }>`으로 교체.
- 첫 등장 시 `{ raw_row_no, source_sheet }`를 저장.
- 중복으로 판정될 때(`action: "skipped_duplicate"`) `reason` 문자열을 다음과 같이 확장:
  - 동일 시트인 경우: `파일 내 중복 (원본 Row #118)`
  - 다른 시트인 경우: `파일 내 중복 (원본 ELEC!Row #118)`

### 2. UI 변경 없음
Row Details 테이블의 **Reason** 컬럼이 이미 노출되어 있으므로 새 컬럼 추가 없이 정보가 표시됩니다. (별도 컬럼이 필요하면 추가 요청 부탁드립니다.)

### 적용 범위
- 향후 신규 임포트부터 적용됩니다. 기존 배치 로그는 재임포트해야 새 reason이 기록됩니다.

### DB / 스키마 변경
없음. `mdr_import_row_logs.reason` 컬럼 텍스트만 풍부해집니다.
