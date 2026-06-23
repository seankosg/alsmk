## 문제 요약

업로드 엑셀(`02_SMP_CCM_MDR_progress-6.xlsx`)의 ARCH/STR/MECH/ELEC 시트는 헤더가 2행 구조입니다.

- row 4: `NO. | DISCIPLINE | DWG. NO (병합) | … | ACTIVITY GROUP | DRAWING TITLE | SD Stage | DD Stage | CD Stage | SD50% | SD100% | …`
- row 5 (서브헤더): `(공백)(공백) | PLANT ID | PBS | FBS | SER. NO. | REV. NO. | … | SD50% | SD100% | DD30% | …`

`DWG. NO` 셀이 C4:G4로 가로 병합되어 있어 PLANT ID/PBS/FBS/SER.NO./REV.NO.의 row 4 셀이 전부 빈값입니다. 현재 `parser.ts`는 비‑마일스톤 컬럼에서 row 4 텍스트만 읽어 헤더 키를 매핑하므로 이 5개 컬럼이 모두 누락 → 4토큰 모두 missing → fallback 발동 → `__UNKNOWN__-ARCH-8-A`, `…-9-A`처럼 행 번호 기반 Doc. No.가 만들어집니다.

## 수정 범위

`src/lib/mdr/parser.ts` 단 한 파일.

### 변경 1 — 헤더 텍스트를 row 4 + row 5 결합으로 인식

비‑마일스톤(else) 분기(L243~247)에서 헤더 텍스트를 다음 우선순위로 결정:

1. `cellStr(ws, headerRow, c)` (row 4)
2. 비었거나 `detectColumnKey` 결과가 null이면 `cellStr(ws, milestoneLabelRow, c)` (row 5)

`detectColumnKey`로 키가 잡힌 텍스트(또는 식별성 키워드)를 우선 보존하여 `headers` 배열에 push합니다. 이때 row 5 텍스트가 마일스톤 패턴(`SD50%` 등)일 가능성은 milestone 분기에서 이미 걸러지므로 안전.

### 변경 2 — `isIdentHeader` 도 row 4 ∪ row 5 기준

마일스톤 그룹의 경계 판정 함수도 두 행 텍스트를 합쳐 평가하도록 보강. (예: row 4 빈값 + row 5 "PLANT ID" → 식별 헤더로 인정, 마일스톤 그룹이 식별 컬럼을 흡수하지 않도록 보호)

### 변경 3 — `serHeader` / `findVal` 매칭은 그대로 유지

`headers` 배열의 `text` 필드에 row 5 서브헤더가 들어오면 기존 정규식(`/^\s*ser\.?\s*no\.?\s*$/i`)과 `findVal("Plant ID","PLANT","JOB")`, `findVal("PBS",…)`, `findVal("FBS",…)`, `findVal("REV","REVISION")` 호출이 자동으로 정상 매칭됩니다. 별도 수정 없음.

### 변경 4 — DISCIPLINE 컬럼은 row 4 텍스트 그대로 사용

row 4의 `DISCIPLINE`(B열)은 이미 인식되므로 영향 없음. 행 값(`AR`, `ST` 등)은 정상 추출됩니다.

## 영향 / 검증 시나리오

| 시트 | 기대 Doc. No. (row 8 기준) |
|---|---|
| ARCH | `L2Z1-800-EA100-1-B` |
| ARCH | `L2Z1-800-EA100-2-A` (row 9) |
| ARCH | `L2Z1-800-EA100-3-A` (row 10) |

REV.NO.가 빈 셀인 행(예: row 11)은 기존 기본값 `"A"`로 채워져 `L2Z1-800-EA100-11-A` 형태가 됩니다.

## 회귀 방지

- 단일 헤더 행만 있는 구버전 시트(예: GEN 파일 등)는 row 4에 PLANT ID 등이 직접 있으므로 변경 1의 1순위에서 그대로 잡힙니다.
- row 5에 마일스톤 라벨이 있는 컬럼은 milestone 분기로 먼저 처리되어 헤더 배열에 들어가지 않으므로 충돌 없음.
- 동일 시리즈 파일(`02_…-2~-6.xlsx`)은 헤더 구조가 동일하여 일괄 해결됩니다.

## 변경 파일

- `src/lib/mdr/parser.ts` — 헤더 인식 로직(L207~248) 보강만 수행.

## 범위 외

- DB 마이그레이션 없음 (Doc. No.는 임포트 시점에 새로 생성됨).
- `columnMap.ts` 별칭 추가 불필요 (이미 `ser. no.` 등 포함).
- 기 임포트된 4,176건의 `__UNKNOWN__-…` 데이터는 새 헤더 인식으로 **재임포트**해야 정상 Doc. No.로 덮어써집니다. 필요 시 기존 `__UNKNOWN__` 행 일괄 삭제 마이그레이션을 별도 항목으로 추가할 수 있습니다(승인 시 추가 안내).
