# 단계별 도면 범위(Stage Scope) 도입 계획

## 배경 (확정된 사실)

엑셀 헤더에 별도 `SD / DD / CD` 컬럼이 존재하며, 셀 값이 `"O"` 인 단계만 그 도면에 필요한 단계다. `"O"` 가 없는 단계는 그 도면에는 존재하지 않는 단계로 본다.

집계 예시 (6개 최신 파일):

```text
GEN     ARCH      SD  6  DD 27  CD 37
SMP&CCM ARCH     SD 25  DD 338 CD 362
SMP&CCM STR      SD 17  DD 201 CD 220
SMP&CCM MECH     SD 37  DD 196 CD 196
SMP&CCM ELEC     SD 14  DD 417 CD 431
HSM     ARCH     SD 13  DD 265 CD 266
HSM     STR      SD  8  DD 174 CD 195
HSM     MECH     SD 13  DD 181 CD 184
HSM     ELEC     SD 13  DD 313 CD 325
CRM     ARCH     SD 14  DD 442 CD 443
CRM     STR      SD 22  DD 378 CD 395
CRM     MECH     SD 22  DD 398 CD 398
CRM     ELEC     SD 13  DD 760 CD 772
MAIN_O  ARCH     SD 11  DD 32  CD 69
MAIN_O  STR      SD 14  DD 20  CD 30
MAIN_O  MECH     SD 27  DD 63  CD 67
MAIN_O  ELEC     SD 14  DD 55  CD 61
FAFP    FA,FP    SD  0  DD 27  CD 73
```

승인된 정책:
- A. `"O"` 없는 단계는 그 도면에서 완전 제외 (단계별 도면수·진척·weight 모두 0/없음).
- B. 도면 1건의 Overall % 계산 시 `"O"` 인 단계만 골라 SD/DD/CD weight 합이 1이 되도록 정규화 (예: CD-only → CD=100%).
- C. 6개 파일을 다시 import 하여 신규 필드를 채운다.

## 구현

### 1. 데이터 모델 — `mdr_drawings` 에 3개 컬럼 추가
- `in_scope_sd boolean not null default false`
- `in_scope_dd boolean not null default false`
- `in_scope_cd boolean not null default false`

마이그레이션 1건. 기본값 false 로 두어 import 전까지는 모든 도면이 "범위 미정"으로 표시되고, 재임포트 시 갱신.

### 2. Parser — `src/lib/mdr/parser.ts`
- 헤더 행에서 단독 셀 `SD`, `DD`, `CD` (마일스톤 `SD50%` 등과 구분) 컬럼을 식별해 보관.
- 행 파싱 시 그 셀의 `isYes()` 결과를 `inScope.{sd,dd,cd}` 로 `MdrParsedRow` 에 추가.
- 기존 `outOfScope`(모든 마일스톤 increment 0) 로직은 유지하되, 추가로 세 단계 모두 false 면 전체 outOfScope 로 간주.
- 단계 scope 가 false 인 단계의 마일스톤·progress 는 파싱 단계에서 제거(또는 빈 배열).

### 3. Importer — `src/lib/mdr/importRunner.ts`
- 신규 컬럼 3개를 insert/update 페이로드에 포함.
- 같은 doc_base 의 rev_update 시에도 갱신.

### 4. 진척률 엔진 — `src/lib/mdr/progressEngine.ts`
- `drawingOverall(milestones, progress, asOf, weights)` 의 weight 정규화 부분에서 그 도면의 `inScope` 단계만 골라 합이 1 이 되도록 재정규화.
- `drawingStagePct` 호출 시 단계가 scope 아니면 `{planned:null, actual:null, delta:null}` 로 반환 → UI 에서 "—" 표시.

### 5. 집계 — `src/lib/mdr/summaryEngine.ts` / 대시보드
- 빌딩·시트별 "SD 도면수 / DD 도면수 / CD 도면수" 를 `in_scope_*` 기준으로 카운트.
- 평균 진척률도 단계별로 scope 내 도면만 분모로 사용.
- 기존 "총 도면수" 는 유지(시트의 총 행 수)하되, 단계별 표기는 분리.

### 6. UI — `MdrAdvancedGrid` 컬럼
- SD/DD/CD 단계 진척 아이콘 셀은 scope 아닐 때 "—" 또는 회색 비활성 표시.
- 컬럼 필터: `In SD scope / In DD scope / In CD scope` 추가.

### 7. 검증 (재임포트 후 자동 비교)
- 위 표의 단계별 합계와 `mdr_drawings.in_scope_*` count 일치 확인.
- SMP&CCM ARCH No.5: SD/DD/CD scope 확인 후 진척 아이콘 표시 일치.
- `Stage In Scope` 컬럼 toggle 으로 0/null 도면 필터 정상 작동.

## 변경 파일

- 마이그레이션 1건 (`add_stage_in_scope_to_mdr_drawings`)
- `src/lib/mdr/parser.ts`
- `src/lib/mdr/importRunner.ts`
- `src/lib/mdr/progressEngine.ts`
- `src/lib/mdr/summaryEngine.ts`
- `src/components/mdr/grid/columns.tsx`, `MdrProgressIconCell.tsx`
- 대시보드 카드 (`DesignManagementCard.tsx`) 및 `DesignSummary.tsx` 의 단계별 카운트 부분
- `src/integrations/supabase/types.ts` 는 마이그레이션 후 자동 갱신

## 실행 순서

1. 마이그레이션 적용 → 컬럼 추가.
2. parser/importer 수정 → 재임포트 6개 파일.
3. progressEngine/summary/UI 수정 → 단계별 분모·표시 정합 검증.
4. 위 표와 DB count 비교 리포트로 마무리.
