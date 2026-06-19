
## 1. 진입·라우팅
- `/design` 단일 라우트, 사이드바 비표시. 메인 대시보드 카드 라벨 **"Design Management"** (Admin/PM만).
- 내부 4탭: `Dashboard`(Phase 2) / `Summary`(Export·스냅샷) / `Raw Data` / `Admin`(가중치).
- Raw Data 탭은 임포트된 건물 수만큼 건물별 sub-탭 자동 생성.

## 2. 건물명·식별 컬럼 정책
- 건물명은 앱이 파일명에서 추출 후 신규 생성.
- **Item No.** = `${BUILDING}-${원본 A열 No.}` (임시 식별자).
- **원본 A열의 "No." 컬럼은 그대로 유지** — Building 컬럼 왼쪽 최좌단.
- 식별 컬럼 순서: `No. → Building → Item No. → DISCIPLINE → JOB No. → Area Code → Function Code → Serial No. → Activity Group → Drawing Title`
- DB 자연키: `UNIQUE(building_code, item_no)`. 재업로드 시 신규 도면만 INSERT, 기존 Y/실제완료일 보존.

## 3. DB 정규화 (7테이블)
`mdr_buildings`, `mdr_drawings`(★`source_no` 원본 A열 보존 + `item_no` 신규), `mdr_milestones`, `mdr_progress`, `mdr_weights`(+`mdr_weights_audit`), `mdr_snapshots`(★`template_blob bytea` 원본 워크북 보관), `mdr_import_logs`. 모두 GRANT + RLS + Admin/PM 전용 정책.

## 4. 파서 (`src/lib/mdr/parser.ts`)
- **FA·FP 전용 분기 로직 삭제**. 파일명=건물명 일관 처리.
- 헤더 인식: `NO.` 셀 → 하위 3행(라벨/증분/계획일자).
- 마일스톤 정규식 `(SD|DD|CD)\s*(\d+)%` — SD는 폐기(상수 100% 처리).
- 계획일자: `XLSX.SSF.parse_date_code`.
- 분야: 시트명(ARCH/STR/MECH/ELEC), `MH&DWG/Sheet1/Sheet3` 스킵.
- 행마다 `source_no` 보존 + `item_no` 생성.

## 5. 검증 게이트 (`src/lib/mdr/validator.ts`)
DD·CD 6행 증분 합 ±1% 검증 → 누계 자동 차분 보정 → 실패 시 모달(자동보정/라벨모드/시트스킵/중단). 결정 로그 `mdr_import_logs.user_decisions`.

## 6. 진척 엔진 — 일일 보간 ★
엑셀 계획은 마일스톤별 주간 증분이지만, 진척 엔진은 **임의 기준일에 대해 선형 일일 보간**으로 계획률 계산:

```text
plannedPct(drawing, stage, asOf) =
  Σ(완료 마일스톤 증분)
  + 현재 구간 증분 × clamp((asOf - prevDate) / (curDate - prevDate), 0, 1)
```

- `prevDate` = 직전 마일스톤 plan_date(없으면 curDate − 7일).
- 기준일은 격자 헤더에서 변경 가능(기본 today).
- 실적률은 마일스톤 step 함수(Y 시점만 반영).

## 7. Raw Data 격자 — 컬럼 구조

| 그룹 | 컬럼 | 비고 |
|---|---|---|
| 식별 | `No.` · `Building` · `Item No.` · `DISCIPLINE` · `JOB No.` · `Area Code` · `Function Code` · `Serial No.` · `Activity Group` · `Drawing Title` | `No.` = 원본 A열 그대로 |
| 대상 | `SD` · `DD` · `CD` | `O/-`. SD 항상 `O` |
| DD 단계 | `DD30 P/A/Δ` · `DD60 P/A/Δ` · `DD90 P/A/Δ` · `DD100 P/A/Δ` | P=일일보간 계획, A=실적, Δ=P−A |
| CD 단계 | `CD30 P/A/Δ` · `CD60 P/A/Δ` · `CD100 P/A/Δ` | 동일 |
| 누계 | `SD%` · `DD%` · `CD%` · `Overall%` | SD=100 상수 |
| 일자 | `Plan Finish` · `Actual Finish` | |
| 메타 | `Confirmed By` · `Source Sheet` · `Out of Scope` | |

### 7.1 행/필터 동작
- Y 토글: Admin/PM만 → `mdr_progress` upsert.
- 상단 필터: 분야, 단계 대상(`O`만), 검색.
- **지연 임계는 사용자 입력값** — 격자 헤더 NumberInput(`Δ 임계 %`, 기본 10, 0~100). 임계 이상 `text-destructive`, 0<Δ<임계 `text-yellow-500`, ≤0 녹/회. localStorage(`mdr.deltaThreshold`)에 저장.
- 기준일(asOfDate) 헤더에서 변경 → 즉시 클라이언트 재계산.

## 8. Export — 엑셀 양식 그대로 (SHAW Defect Raw Data export 패턴 차용) ★

### 8.1 출력 정책
- **원본 엑셀 레이아웃·서식·테두리·색상·조건부서식 모두 포함**하여 재현.
- 구현(`src/lib/mdr/exporter.ts`): 업로드 시 `mdr_snapshots.template_blob`에 저장된 **원본 워크북을 템플릿으로 로드** → 셀 객체의 `s`(스타일)는 보존, `v`(값)만 현재 DB 상태로 패치. 신규 워크북을 만들지 않음.
- SD 컬럼은 양식대로 100% 완료(Y) 출력.
- **앱 신규 컬럼(`Building`, `Item No.`)도 그대로 유지 출력** — 원본 A열 좌측에 컬럼 삽입(시트는 약간 확장되지만 의미 유지). 헤더 스타일은 인접 헤더 셀의 스타일을 복사.

### 8.2 재임포트 마커 + 컬럼 매핑 사전
- 시트 `Defined Name`에 `[Format: ALSMK_MDR_REIMPORT_V1]` 마커 삽입(SHAW의 `REIMPORT_MARKER` 패턴 차용).
- **신규 컬럼 매핑 사전** `src/lib/mdr/columnMap.ts` 단일 출처:

```ts
export const MDR_COLUMN_MAP = {
  no:        { header: 'No.',      source: 'original_a' },
  building:  { header: 'Building', source: 'app_generated', preserveOnReimport: true },
  itemNo:    { header: 'Item No.', source: 'app_generated', preserveOnReimport: true, key: true },
  // discipline, job_no, area_code, function_code, serial_no, ...
} as const;
```

- 임포트 파서는 헤더 텍스트로 신규 컬럼 인식 → `building_code`/`item_no` 자연키 복원. 신규 컬럼이 없는 원본 엑셀도 폴백(파일명에서 건물 추출).
- 재임포트 시 마커 + Item No. 매칭. 정책상 기존 Y 보존, 신규 도면만 INSERT.

### 8.3 파일명
`{NN}_{건물}_MDR PROGRESS_{YYMMDD}.xlsx`. SUMMARY는 `00_SUMMARY_{YYMMDD}.xlsx`.

## 9. Admin — 가중치 표 (엑셀 그대로) ★
SUMMARY 파일의 가중치 시트(분야×단계, 건물×분야 매트릭스)를 **엑셀 원본과 동일한 표 레이아웃**으로 Admin에 렌더링:
- 좌측: 건물(행), 상단: 분야×단계(컬럼), 셀: weight value.
- 셀 클릭 → inline 편집(Admin/PM만), 저장 시 `mdr_weights` upsert + `mdr_weights_audit` 로그.
- 상단 토글: `참고값 (is_reference_only)` ↔ `활성 가중치`. "참고값 → 활성 적용" 버튼.
- 기본값은 균등(1.0). SUMMARY 임포트 시 참고값으로 시드.

## 10. 자동 스냅샷
업로드 성공 시 (건물×분야×단계)별 1행씩 `mdr_snapshots` INSERT, `snapshot_date = 업로드일`. **원본 워크북 바이너리는 `template_blob`에 보관** — Export 템플릿으로 재사용.

## 11. 권한
`/design`, Import, Export, Y 토글, 가중치 편집: Admin/PM 전용. 카드·라우트·버튼 모두 게이트.

## 12. 작업 순서
1. 마이그레이션 (7테이블 + `template_blob` + `weights_audit` + 균등 시드).
2. `src/lib/mdr/{parser,validator,progressEngine,exporter,columnMap,weights}.ts`.
3. `/design` 셸 + Raw Data 격자(7장 컬럼 구조 + 임계 입력 + 기준일).
4. Import 다이얼로그 + 검증 모달 + 자동 스냅샷(원본 blob 포함).
5. Summary 탭(Export·스냅샷 목록·재다운로드), Admin 탭(가중치 매트릭스·감사 로그).
6. 대시보드 진입 카드.
7. 첨부 7개 파일 임포트 → 원본 양식 그대로 Export → 재임포트 라운드트립 검증.

## Phase 1 범위 밖
Dashboard 시각화(S-curve, 지연 분포), 토목 제외·소방 별도 합산 UI, 주간 리포트는 Phase 2.
