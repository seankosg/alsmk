## 누락 엑셀 컬럼 전체 보존 — 구현 플랜

선택: **옵션 3 (전체 보존)**. 매핑 누락된 12개 헤더를 `mdr_drawings`에 영구 저장하고, 그리드 표시 및 재임포트 왕복(round-trip) 호환성을 보장합니다.

### 1. 데이터베이스 마이그레이션

`mdr_drawings`에 컬럼 추가 (모두 NULLABLE, 기존 행은 NULL):

| 컬럼 | 타입 | 출처 헤더 |
|---|---|---|
| `confirmed_by` | TEXT | `Confirmed By` |
| `ifr_start_date` | DATE | `Plan Date > IFR/IFI > Start Date` |
| `ifr_issue_date` | DATE | `Plan Date > IFR/IFI > Issue Date` |
| `ifc_start_date` | DATE | `Plan Date > IFC > Start Date` |
| `ifc_issue_date` | DATE | `Plan Date > IFC > Issue Date` |
| `document_class` | TEXT | `Document Class` |
| `doc_class_code` | TEXT | `문서분류체계 > 코드` |
| `stage_plan_sd` | DATE | `SD Stage` 헤더의 통합 Plan 날짜 (행7) |
| `stage_plan_dd` | DATE | `DD Stage` 헤더의 통합 Plan 날짜 |
| `stage_plan_cd` | DATE | `CD Stage` 헤더의 통합 Plan 날짜 |

`TBD`/공백은 NULL 저장. 마이그레이션은 GRANT/RLS 변경 없음 (기존 정책 그대로 적용).

### 2. `parser.ts`

- `MdrParsedRow`에 위 10개 필드 추가 (모두 optional).
- 헤더 탐지:
  - `Confirmed By` / `Document Class` / `문서분류체계` / `코드` → `findVal()` 후보 확장.
  - `Plan Date` 그룹: 행4 `Plan Date` 병합 셀 + 행5 `IFR/IFI` `IFC` + 행7 `Start Date`/`Issue Date` 4쌍을 좌→우 순서로 컬럼 인덱싱.
  - `SD Stage`/`DD Stage`/`CD Stage`: 행4 헤더 텍스트 매칭 → 행7 셀의 날짜를 `stage_plan_*`으로 저장. (부수적으로 scope 컬럼 인식도 `"SD"|"SD STAGE"` 양쪽 허용으로 확장.)
- `parseDate()` 재사용, 문자열 `TBD/-` 등은 undefined.

### 3. `columnMap.ts`

새 키 추가 (모두 `source: "original"`, `preserveOnReimport: true`):

```ts
confirmedBy:     { header: "Confirmed By",        source: "original", preserveOnReimport: true }
ifrStart:        { header: "IFR/IFI Start Date",  source: "original", preserveOnReimport: true }
ifrIssue:        { header: "IFR/IFI Issue Date",  source: "original", preserveOnReimport: true }
ifcStart:        { header: "IFC Start Date",      source: "original", preserveOnReimport: true }
ifcIssue:        { header: "IFC Issue Date",      source: "original", preserveOnReimport: true }
documentClass:   { header: "Document Class",      source: "original", preserveOnReimport: true }
docClassCode:    { header: "문서분류체계 코드",    source: "original", preserveOnReimport: true }
stagePlanSd:     { header: "SD Stage Plan",       source: "app_generated", preserveOnReimport: true }
stagePlanDd:     { header: "DD Stage Plan",       source: "app_generated", preserveOnReimport: true }
stagePlanCd:     { header: "CD Stage Plan",       source: "app_generated", preserveOnReimport: true }
```

HEADER_ALIASES에 `"ifr/ifi start date"`, `"ifc start date"`, `"코드"` 등 변형 추가.

### 4. `importRunner.ts`

- INSERT/UPDATE payload에 새 10개 컬럼 매핑 (snake_case).
- 변경 없는 행 식별 로직(`isUnchanged`)에 새 필드도 포함 → 진정한 변화만 update.

### 5. `exporter.ts`

- 신규 컬럼이 템플릿에 이미 존재하면 값만 patch.
- 없으면 우측 끝에 헤더 추가 후 값 작성 (Building/Item No 추가 로직과 동일 패턴).
- 재임포트 시 `detectColumnKey`가 다시 인식하도록 헤더 텍스트 통일.

### 6. 그리드 (`columns.tsx`, `MdrDrawingRow`)

- `MdrDrawingRow` 인터페이스에 10개 필드 추가.
- 신규 컬럼 정의 (기본 숨김 처리 가능하도록 `meta: { hideByDefault: true }` 추가 — 사용자가 컬럼 토글로 표시):
  - `Confirmed By`, `Document Class`, `Doc Class Code` — 텍스트 필터
  - `IFR Start/Issue`, `IFC Start/Issue`, `SD/DD/CD Plan` — 날짜 범위 필터
- 기본 표시되는 컬럼 순서는 변경하지 않음 (오른쪽 끝에 추가).

### 7. `useGridStatePersistence.ts`

- 신규 컬럼 ID가 저장된 visibility 상태와 충돌하지 않도록 기본 hidden 보장.

### 8. 영향 없음 (확인)

- `progressEngine`, `summaryEngine`, `weights`, `mdr_progress`, `mdr_snapshots`, CPM, 메시징, 권한 정책 — 변경 없음.
- 기존 행의 NULL 컬럼은 그리드에서 `-`로 표시.

### 9. 사용자 후속 작업

1. 마이그레이션 자동 적용 후 **엑셀 재임포트** 1회 → 신규 10개 컬럼 일괄 채움.
2. 그리드의 컬럼 토글 메뉴에서 원하는 신규 컬럼 표시.

### 변경 파일

- `supabase/migrations/<timestamp>_mdr_extended_columns.sql` (신규)
- `src/lib/mdr/parser.ts`
- `src/lib/mdr/columnMap.ts`
- `src/lib/mdr/importRunner.ts`
- `src/lib/mdr/exporter.ts`
- `src/components/mdr/grid/columns.tsx`
- `src/components/mdr/grid/useGridStatePersistence.ts` (필요 시)
- `src/integrations/supabase/types.ts` (자동 재생성)
