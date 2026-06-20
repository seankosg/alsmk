
## 진단 결과

업로드된 4개 엑셀과 DB 상태(`mdr_buildings`, `mdr_drawings`, `mdr_import_logs`)를 대조한 결과, 4가지 결함이 동시에 작용하여 “건물명 오류 + 분야 탭 누락”이 발생했습니다.

### DB 현재 상태
- `mdr_buildings`: `SMP&CCM`, **`PROGRESS`**, **`PROGRESSS`** (3개) — `GEN`, `HSM`, `CRM`, `MAIN`(OFFICE) 누락
- `mdr_drawings`: `PROGRESS|ARCH|372`, `SMP&CCM|ARCH|372` — **ARCH 시트만** 적재, STR/MECH/ELEC 전부 누락
- 임포트 로그: `01_GEN_MDR progress.xlsx → PROGRESS`, `03_HSM_MDR progressS.xlsx → PROGRESSS` 등 건물 코드 자체가 잘못 저장됨
- `MAIN OFFICE`, `FAFP` 파일은 임포트 시도 자체가 없음

### 원인 1 — 옛 버전 `extractBuildingFromFilename`로 적재됨
현재 소스(`src/lib/mdr/parser.ts`)의 4단계 폴백 로직은 모든 파일명에 대해 올바른 결과(`GEN`, `SMP&CCM`, `HSM`, `CRM`, `MAIN`)를 반환합니다(로컬 검증 완료). 그러나 DB의 `PROGRESS`/`PROGRESSS`는 함수 4단계 중 **마지막(tail)** 폴백 — 파일명의 마지막 토큰을 대문자화 — 가 실행되어야 나오는 값입니다. 즉 임포트 시점에는 1·2단계가 모두 실패하던 옛 버전이 배포되어 있었던 것이므로, 잘못 적재된 building row를 정리하고 재임포트해야 합니다.

### 원인 2 — `parseSheet`의 헤더 행 오프셋 불일치 (핵심 결함)
파서는 다음 3행 구조를 가정합니다:
```
headerRow      : NO. | DISCIPLINE | ... | SD30% | SD100% | DD30% | ...
headerRow + 1  : (increment %)
headerRow + 2  : (plan date)
```
실제 업로드 파일은 한 행 어긋난 구조입니다:
```
row 4 (headerRow)  : NO. | DISCIPLINE | ... | SD | DD | CD | SD | ... | Design Development | ...
row 5 (headerRow+1): (빈칸) ... | SD50% | SD100% | Progress | DD30% | DD60% | DD90% ...   ← 마일스톤 라벨
row 6 (headerRow+2): Plan | Plan | Plan | 0.5 | 0.05 | 0.1 ...                            ← increment %
row 7+             : 데이터
```
`MILESTONE_RE`(`(SD|DD|CD)\d{1,3}%`)는 `headerRow`에서 `SD`/`DD`/`CD`만 발견하므로 매칭 0건 → `milestoneCols`가 비어 마일스톤/진척이 전혀 파싱되지 않습니다. 결과적으로 모든 행이 `outOfScope=true`로 저장되고, 가중치 계산이 무력화됩니다.

### 원인 3 — `itemNo` 충돌로 STR/MECH/ELEC 시트가 전부 스킵
`itemNo = ${building}-${sourceNo}`이고 `sourceNo`는 각 시트의 1열(`1, 2, 3...`)입니다. ARCH가 먼저 적재되면서 `PROGRESS-1`, `PROGRESS-2`, ...가 만들어지고, 동일 building_code로 STR/MECH/ELEC가 들어올 때 `MdrImportDialog`의 중복 체크
```ts
.eq("building_code", parsed.building).eq("item_no", row.itemNo)
```
에 걸려 전부 스킵됩니다. 그래서 `rows_skipped=540`/`618` 같은 거대한 스킵 수치가 발생합니다.

### 원인 4 — `MAIN OFFICE`/`FAFP` 미임포트 + 공백 처리
- `MAIN OFFICE` 파일은 단순히 임포트 시도가 없었거나, 현재 로직이 `MAIN`만 추출해 “OFFICE”가 잘립니다.
- 공백이 포함된 건물명은 1·2단계 모두 `split(/\s+/)[0]`를 적용하므로 의도적으로 첫 단어만 남게 되어 있습니다.

---

## 수정 계획

### A. `src/lib/mdr/parser.ts` — 헤더 자동 정렬

`parseSheet`의 `findHeaderAnchor` 직후, 마일스톤 라벨이 어느 행에 있는지 자동 탐지하도록 변경합니다.

```text
1. headerRow ~ headerRow+2 범위에서 각 행을 스캔
2. (SD|DD|CD)\d+% 패턴이 가장 많이 매칭되는 행을 milestoneLabelRow로 지정
3. incrementRow = milestoneLabelRow + 1
4. planDateRow  = milestoneLabelRow + 2
5. 데이터 시작 행 = milestoneLabelRow + (planDateRow가 날짜인 경우 3, 아니면 2)
```
`planDateRow`에 날짜가 없는 파일도 있을 수 있으므로, 해당 행의 셀이 모두 비-날짜면 데이터 시작을 `milestoneLabelRow + 2`로 잡고 `planDate=undefined`로 진행합니다.

### B. `src/lib/mdr/parser.ts` — `itemNo`에 시트 식별자 포함

```diff
- const itemNo = `${building}-${sourceNo}`;
+ const itemNo = `${building}-${discipline}-${sourceNo}`;
```
ARCH/STR/MECH/ELEC의 동일 번호 행이 더 이상 중복으로 간주되지 않도록 합니다. (마이그레이션 불필요 — 신규 row부터 적용)

### C. `extractBuildingFromFilename` — 공백 보존 옵션

`MAIN OFFICE` 같은 다단어 건물명을 정확히 유지하기 위해, 1단계 정규식 캡처 결과의 첫 단어가 아닌 **전체 캡처 문자열**을 `_`로 치환하여 코드화합니다.

```text
"05_MAIN OFFICE_MDR PROGRESS.xlsx"
→ 캡처 "MAIN OFFICE" → trim → 공백을 _로 치환 → "MAIN_OFFICE"
```
2단계 폴백도 동일하게 처리. 기존 단어형(`GEN`, `HSM`, `CRM`)은 영향 없음.

### D. 잘못 적재된 데이터 정리 (마이그레이션)

```sql
-- 잘못된 building 코드의 도면 및 연관 마일스톤·진척·스냅샷 제거
DELETE FROM mdr_progress    WHERE drawing_id IN (SELECT id FROM mdr_drawings WHERE building_code IN ('PROGRESS','PROGRESSS'));
DELETE FROM mdr_milestones  WHERE drawing_id IN (SELECT id FROM mdr_drawings WHERE building_code IN ('PROGRESS','PROGRESSS'));
DELETE FROM mdr_snapshots   WHERE building_code IN ('PROGRESS','PROGRESSS');
DELETE FROM mdr_drawings    WHERE building_code IN ('PROGRESS','PROGRESSS');
DELETE FROM mdr_buildings   WHERE code         IN ('PROGRESS','PROGRESSS');
-- 잘못된 임포트 로그도 정리
DELETE FROM mdr_import_logs WHERE building_code IN ('PROGRESS','PROGRESSS');
```

### E. 검증
1. 빌드 통과 확인.
2. 사용자에게 4개(혹은 6개) 파일을 다시 임포트하도록 안내.
3. 임포트 후 `mdr_buildings`에 `GEN`, `SMP&CCM`, `HSM`, `CRM`, `MAIN_OFFICE`(+`FAFP`) 가 정확히 생성되는지, 각 건물에 ARCH/STR/MECH/ELEC 4개 시트 탭이 모두 표시되는지, 마일스톤 % / Plan Date 컬럼이 채워지는지 확인.

---

## 변경 파일
- `src/lib/mdr/parser.ts` — A, B, C 항목
- `supabase/migrations/...` 신규 — D 항목 (DELETE 마이그레이션)

UI/스타일 변경 없음, RLS·트리거 변경 없음.
