# Doc No 자연키 전환 — 영향 로직 전수 검토 및 계획 (v2)

## 1. 식별자 정의

- **자연키 = `doc_base`** (= Plant-PBS-FBS-SerNo, Rev 제외). UI 표기는 `doc_no = doc_base-rev`.
- **고유 범위 = `(building_code, doc_base)`**.
- Rev 비교 정책(skip_same_rev / rev_update / 이력 스냅샷)은 그대로, 비교 키만 교체.
- `item_no`는 호환·검색용 보조 컬럼 (제거하지 않음, UNIQUE 아님).

DB는 현재 비어 있어 데이터 마이그레이션 부담 없음. 6개 파일 재임포트로 채움.

## 2. ★ 토큰 누락 행 처리 정책 (변경됨)

**모든 행은 Import 한다.** Plant/PBS/FBS/Ser No. 중 일부가 비거나 TBD/N/A여도 행을 거부하지 않는다.

- 누락 토큰은 빈 문자열 `""`로 보관 (placeholder는 빈칸으로 정규화).
- `doc_base`는 **빈 토큰 포함 그대로 join**해서 생성. 예: `JOB1--FBS3-SER9` (PBS 누락) → 그래도 식별자로 사용.
- `doc_no` = `doc_base-rev` 동일 규칙.
- UI(그리드/Doc No 셀)에서 **빈 토큰 위치를 붉은색 배경 + "⚠" 마크**로 표시해 사용자 주의를 유도.

이렇게 하면:
- 사용자가 엑셀에서 누락분을 채우고 재임포트하면 동일 `doc_base`(또는 변경된 경우 신규 도면)로 자동 처리됨.
- 단점: 같은 빌딩 내 여러 행이 동일하게 토큰을 누락하면 같은 `doc_base`로 충돌 → UNIQUE 위반. 이 경우는 import 시 **명시적 에러**로 분리해 사용자에게 행 번호와 함께 안내.

## 3. 영향 받는 기존 로직 (수정 대상 전수)

### A. 파서 — `src/lib/mdr/parser.ts`
- placeholder 정규화는 유지 (`TBD/N/A/-` 등 → 빈 문자열).
- `docBase`는 빈 토큰 포함 항상 생성. 단, 4개가 모두 비어 있으면 `null`로 두고 `errors[]`에 기록.
- 행 단위 메타 `missingTokens: { plantId, pbs, fbs, serNo }` boolean 4개를 `MdrParsedRow`에 추가 → UI 하이라이트 근거.
- 같은 시트 내 `doc_base` 중복은 errors가 아니라 경고 리스트로 보관(첫 행만 insert, 이후는 skipped_duplicate로 분리).

### B. Importer — `src/lib/mdr/importRunner.ts`
- 매칭/중복 키 `item_no` → `doc_base` 교체.
- insert/update 페이로드에 **누락 플래그 4개 컬럼**(`missing_plant_id`, `missing_pbs`, `missing_fbs`, `missing_ser_no` boolean) 포함.
- 파일 간 doc_base 충돌(다른 source_sheet/raw_row인데 동일 `(building, doc_base)`)은 DB UNIQUE 위반 → catch 후 rowLogs에 `skipped_existing` + reason "doc_base 중복 (이전 행과 동일 식별자)" 로 기록.

### C. 컬럼 매핑·exporter — `src/lib/mdr/columnMap.ts`, `src/lib/mdr/exporter.ts`
- `itemNo.key: true` → `false`. `docBase` 또는 `docNo`에 `key: true`.
- exporter 컬럼 순서 검토 (Doc No 우선).

### D. 행 로그 페이지 — `src/pages/DesignImportLogs.tsx`
- `mdr_import_row_logs.doc_base TEXT` 컬럼 추가(마이그 H에 포함).
- 행 로그 insert 시 `doc_base` 동시 저장.
- 역조회 쿼리: `.in("doc_base", chunk)` + `building_code` 필터.
- 테이블에 "Doc No." 열 추가. 검색 hay에 `doc_base/doc_no` 포함.

### E. 그리드 — `src/components/mdr/grid/columns.tsx`, `MdrAdvancedGrid.tsx`
- Doc No 컬럼을 최우선 식별 컬럼으로 배치 + 기본 정렬 키 변경 검토.
- **Doc No 셀 렌더러**: `missing_*` 플래그가 true인 토큰 위치에 붉은색 배경(`bg-destructive/20 text-destructive`) + Tooltip "PBS 누락 — 엑셀에서 보완 필요" 표시.
- export 라벨 매핑에서 Doc No 우선.

### F. Bulk 작업 — `MdrBulkActionBar.tsx`
- 미리보기 표 식별자 컬럼을 `item_no` → `doc_no` (병기 가능). 로직 자체는 uuid 기반이라 무관.

### G. 이력 테이블 — `mdr_drawing_revisions`
- 이미 `doc_base` 컬럼 보유. 단, 도면 본 테이블이 `doc_base NOT NULL`이 되므로 이력 테이블도 동일 강화 + `(building_code, doc_base, rev)` 보조 인덱스.

### H. DB 스키마 마이그레이션 1건
- `mdr_drawings.doc_base NOT NULL` (현재 DB 비어 있어 안전).
- 기존 `(building_code, item_no)` UNIQUE 인덱스 DROP, 비고유 인덱스로 재생성.
- `(building_code, doc_base)` UNIQUE 인덱스 **전체 UNIQUE**로 재생성(부분 조건 제거).
- `mdr_drawings`에 누락 플래그 4컬럼 추가:
  `missing_plant_id boolean NOT NULL DEFAULT false`,
  `missing_pbs boolean NOT NULL DEFAULT false`,
  `missing_fbs boolean NOT NULL DEFAULT false`,
  `missing_ser_no boolean NOT NULL DEFAULT false`.
- `mdr_import_row_logs.doc_base TEXT` 컬럼 추가.

### I. Import UI — `ImportShell.tsx` / `useMdrImporter.ts`
- 파서 결과의 `errors[]`(4토큰 모두 결측 등)와 `missingTokens` 통계를 import 사전 미리보기에 표시:
  "PBS 누락 12행, FBS 누락 3행" 같은 요약. Import는 진행 가능.
- import 완료 후 결과 토스트에 "주의가 필요한 도면 N건" 링크 → Doc No 누락 필터로 그리드 이동.

### J. 외부 참조
- `mdr_milestones/progress`는 `drawing_id`(uuid) FK라 영향 없음.

## 4. 영향 받지 **않는** 로직

- progressEngine, summaryEngine, weights: drawing row 객체 단위로 동작.
- CPM, Tasks, Auth, Messaging 등 MDR 외 모든 모듈.

## 5. 실행 순서

1. 마이그레이션 H 적용.
2. `parser.ts`: missingTokens / 항상-doc_base 생성으로 수정.
3. `importRunner.ts`: 매칭 키 doc_base 교체, missing_* 페이로드, doc_base 중복 catch.
4. `columnMap.ts`/`exporter.ts`: key 플래그 교체.
5. `DesignImportLogs.tsx`: 역조회·UI 갱신.
6. 그리드: Doc No 우선 + **빈 토큰 붉은색 하이라이트** 렌더러.
7. `MdrBulkActionBar` / `ImportShell` UI 보정.
8. 6개 파일 재임포트 → 단계별 도면수 및 누락 통계 검증.

## 6. 사용자에게 미리 알릴 위험

- 같은 빌딩 내 토큰이 모두 같은 패턴으로 누락된 여러 행이 있으면 **doc_base가 동일해져 두 번째부터 import 거부**됨 (UNIQUE). 결과 화면에서 해당 행 목록을 안내.
- 추후 엑셀에서 누락 토큰을 채우면 **doc_base 문자열 자체가 변경**되어 새 도면으로 인식, 이전 진척 이력이 끊김. 운영 규칙으로 "누락 토큰은 가급적 첫 import 전에 채울 것" 안내 권장.

## 7. 변경 파일

- 마이그레이션 1건
- `src/lib/mdr/parser.ts`
- `src/lib/mdr/importRunner.ts`
- `src/lib/mdr/columnMap.ts`
- `src/lib/mdr/exporter.ts`
- `src/pages/DesignImportLogs.tsx`
- `src/components/mdr/grid/columns.tsx` (Doc No 셀 렌더러 신규)
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`
- `src/components/mdr/grid/MdrBulkActionBar.tsx`
- `src/components/mdr/import/ImportShell.tsx` 또는 `useMdrImporter.ts`
- `src/integrations/supabase/types.ts` (자동)
