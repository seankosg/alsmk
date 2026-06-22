## 목적
이전 검증에서 발견된 4가지 근본 문제(빌딩 코드 잘림, discipline override 부작용, docBase가 unique key가 아님, TBD 플레이스홀더)를 한 번에 수정하고 5개 파일 재import가 정상 처리되도록 합니다.

## 수정 사항

### 1. 빌딩 코드 추출 정규식 — `parser.ts` line 67~84
`extractBuildingFromFilename`의 non-greedy `.+?` 때문에 `SMP_CCM` → `SMP`, `MAIN_OFFICE` → `MAIN`으로 잘리는 문제 수정.

**Before**
```ts
const m = base.match(/^\d+[_\s\-]+(.+?)[_\s\-]+MDR\b/i);
```
**After**
```ts
const m = base.match(/^\d+[_\s\-]+(.+)[_\s\-]+MDR\b/i); // greedy
```
이렇게 하면 `02_SMP_CCM_MDR_progress` → `SMP_CCM`, `05_MAIN_OFFICE_MDR_PROGRESS` → `MAIN_OFFICE`로 보존됩니다(이후 `toBuildingCode`가 공백 → `_` 정규화).

검증 대상:
| 파일명 | 기존 | 수정 후 |
|---|---|---|
| `01_GEN_MDR_progress-2` | GEN | GEN |
| `02_SMP_CCM_MDR_progress-3` | SMP | **SMP_CCM** |
| `03_HSM_MDR_progress-3` | HSM | HSM |
| `04_CRM_MDR_progress-2` | CRM | CRM |
| `05_MAIN_OFFICE_MDR_progress-3` | MAIN | **MAIN_OFFICE** |
| `06_FAFP_MDR_Progress-2` | FAFP | FAFP |

### 2. DISCIPLINE 컬럼 override 제거 — `parser.ts` line 246~258
이전에 추가했던 "첫 데이터 행의 DISCIPLINE 컬럼값으로 시트 discipline을 덮어쓰기" 로직을 **삭제**합니다. 부작용으로 `ARCH` 시트가 `GEN`/`AR`로, `MECH`가 `HV`로 변경되는 회귀가 발생했습니다.

→ 시트명 기반 헬퍼(`extractDisciplineFromSheetName`)만 사용. FAFP의 `MDR (Drawing)_FA,FP`는 이 헬퍼만으로 `FA,FP` 추출이 검증됨.

### 3. dedup 키를 itemNo로 통일 — `importRunner.ts` line 82~104
SMP/HSM/CRM/MAIN_OFFICE 파일들의 dups는 **원본 데이터에서 같은 `{Job-Area-Function-Serial}` docBase에 여러 도면이 정상적으로 매핑**되어 있는 케이스(예: CRM `L8B1-820-EB130-002`에 PIPING PLAN 2건). 즉 docBase는 본질적으로 unique 키가 될 수 없습니다.

**변경 방침**: docBase는 **표시/조회용으로만 저장**, dedup·매칭은 **항상 `itemNo`(=`{building}-{discipline}-{sourceNo}`) 기반**으로 변경.

- `existingByDocBase` 인덱스 제거, `existingByItemNo`만 사용
- `seenDocBase` 제거, `seenItemNo`만 사용
- `existing = existingByItemNo.get(r.itemNo)`로 일원화
- 중복 사유 메시지: "파일 내 중복 (Item No.)"

이렇게 하면 같은 docBase에 여러 도면이 있어도 sheet+sourceNo가 다르면 정상 import.

### 4. TBD 플레이스홀더 처리 — `parser.ts` line 292~294
docBase 생성 시 `TBD`, `TBA`, `N/A`, `-`, `미정` 등 플레이스홀더 값은 빈 문자열로 간주.

```ts
const PLACEHOLDER_RE = /^(tbd|tba|n\/a|na|미정|tbc|-)$/i;
const tokens = [plantId, pbs, fbs, serNo].map((t) => {
  const v = (t ?? "").trim();
  return PLACEHOLDER_RE.test(v) ? "" : v;
});
const docBase = tokens.every((t) => t.length > 0) ? tokens.join("-") : undefined;
```

→ FAFP 행들의 docBase가 모두 `undefined`가 되어, 표시 시 sourceNo 기반 fallback만 사용됨. itemNo dedup으로 정상 import.

## 예상 검증 결과 (재실행 후)

| 파일 | building | rows | dups (기대) |
|---|---|---|---|
| GEN | GEN | 37 | 0 |
| SMP&CCM | **SMP_CCM** | 1,209 | 0 (itemNo 기반 dedup) |
| HSM | HSM | 973 | 0 |
| CRM | CRM | 2,008 | 0 |
| MAIN OFFICE | **MAIN_OFFICE** | 230 | 0 |
| FAFP | FAFP | 83 | 0 (TBD → docBase undefined) |

단, **시트 내에서 sourceNo(NO.)가 진짜 중복된 행**은 여전히 dup으로 처리됩니다(정상 동작).

## DB 정리
- 기존 잘못된 빌딩 코드(`SMP`, `MAIN`, `FAFP` 중 부분 import된 것)와 이전 CRM 데이터 모두 삭제 후 재import 안내
- 삭제 대상: `mdr_drawings` (FK CASCADE로 milestones/progress/revisions 자동 정리)

```sql
DELETE FROM public.mdr_drawings 
WHERE building_code IN ('SMP', 'MAIN', 'CRM', 'FAFP', 'SMP_CCM', 'MAIN_OFFICE', 'GEN', 'HSM');
```

## 작업 단계
1. `parser.ts`: 빌딩 추출 정규식 greedy화 (#1)
2. `parser.ts`: DISCIPLINE 컬럼 override 블록 삭제 (#2)
3. `parser.ts`: docBase 생성에 PLACEHOLDER 필터 추가 (#4)
4. `importRunner.ts`: docBase 인덱스/seen 제거, itemNo 단일 dedup으로 통일 (#3)
5. 로컬 5개 파일 파싱 재검증 — 모든 building 코드/discipline/dups=0 확인
6. DB의 잘못된 6개 빌딩 데이터 일괄 삭제
7. 사용자에게 UI에서 5개 파일 재import 안내

## 영향 범위
- 수정 파일: `src/lib/mdr/parser.ts`, `src/lib/mdr/importRunner.ts`
- DB 스키마 변경 없음
- 기존 잘못 import된 데이터는 일괄 삭제 후 재import 필요