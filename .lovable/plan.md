## 목표

SUMMARY 엑셀은 더 이상 임포트하지 않습니다. Raw Data(`mdr_drawings` / `mdr_milestones` / `mdr_progress`)로부터 SUMMARY 시트와 동일한 표현(Block×Discipline 매트릭스, Stage별 진척률, Overall, WF)을 앱이 계산해서 표시합니다.

---

## 1. 제거할 것 (정리)

- `src/lib/mdr/summaryParser.ts` 삭제
- `src/components/mdr/MdrImportDialog.tsx`
  - `parseSummaryFile`, `persistSummary` 임포트·함수 제거
  - `isSummaryFilename` 분기 제거 (SUMMARY 파일을 올리면 "SUMMARY는 자동 계산되므로 임포트할 필요가 없습니다" 토스트만)
- DB 마이그레이션: `DROP TABLE public.mdr_summary_matrix`
- `mdr_weights`에 시드된 reference-only 행은 그대로 둠 (재사용 가능, 무해)

---

## 2. WF(가중치) 관리

**(A) 코드 상수** — `src/lib/mdr/weights.ts` 신규 파일:

```ts
export const DEFAULT_STAGE_WF = { SD: 0.2, DD: 0.4, CD: 0.4 };
export const DEFAULT_DISCIPLINE_WF = { ARCH: 0.45, STR: 0.25, MECH: 0.09, FAFP: 0.10, ELEC: 0.11, CIVIL: 0 };
export const DEFAULT_BUILDING_WF = { "SMP&CCM": 0.288, "HSM": 0.132, "CRM": 0.559, "MAIN_OFFICE": 0.021 };
// GEN은 WF 없음 = 합산 제외
```

**(B) DB 저장** — 기존 `mdr_weights` 테이블 재사용:
- Stage WF: `building_code=null, discipline=null, stage='SD'/'DD'/'CD', is_reference_only=false`
- Discipline WF: `building_code=null, discipline='ARCH'..., stage=null, is_reference_only=false`
- Building WF: `building_code='SMP&CCM'..., discipline=null, stage=null, is_reference_only=false`

앱은 DB에서 우선 조회 → 없으면 코드 상수 fallback.

**(C) Admin 편집 UI** — `MdrWeightsEditor.tsx` 확장 (이미 파일 존재):
- 3개 카드: Building WF / Stage WF / Discipline WF
- 각 항목 number input (0~1), 합계 표시, 1.0이 아니면 경고 배지
- "기본값으로 재설정" 버튼 → 상수에서 복원
- 저장 시 `mdr_weights` upsert, 변경 이력은 `mdr_weights_audit`에 자동 기록
- 접근: `is_admin_or_pm` (기존 RLS와 일치)

---

## 3. Raw Data → SUMMARY 계산 로직

**`src/lib/mdr/summaryEngine.ts`** 신규 파일에 모든 계산 집약.

### 3-1. 입력 쿼리

```ts
// 단일 쿼리로 전체 building × discipline × stage 집계
const { data } = await supabase.from("mdr_drawings").select(`
  id, building_code, discipline, out_of_scope,
  mdr_milestones ( stage, pct, plan_date ),
  mdr_progress  ( stage, pct, is_done )
`).eq("out_of_scope", false);
```

### 3-2. 도면 단위 진척 계산

각 도면별로:
- **SD pct** = mdr_progress 중 stage='SD'에서 가장 큰 pct (0/50/100), 없으면 0 → 비율로 환산: pct/100
- **DD pct** = stage='DD'의 최대 pct/100 (0/30/60/90/100)
- **CD pct** = stage='CD'의 최대 pct/100 (0/30/60/100)
- **stage Plan 포함 여부** = 해당 stage 마일스톤이 존재(plan_date 또는 increment_pct>0)

### 3-3. Block × Discipline 집계

```
SD_Plan(B,D)   = count(도면 where SD 마일스톤 존재)
SD_Actual(B,D) = count(도면 where SD pct == 1.0)
SD_Progress(B,D) = Σ(도면별 SD pct) / SD_Plan(B,D)
(DD/CD 동일)
```

### 3-4. 상위 집계 (Stage WF · Disc WF · Building WF 적용)

```
DiscProgress(B,D) = SD_Progress×SD_WF + DD_Progress×DD_WF + CD_Progress×CD_WF
BlockProgress(B)  = Σ(DiscProgress(B,D) × Disc_WF(D)) / Σ(Disc_WF where 도면 존재)
Overall           = Σ(BlockProgress(B) × Building_WF(B))     // GEN은 WF 없음 → 자동 제외
```

### 3-5. 주차별 누적 (선택, Phase 2)

SUMMARY 시트의 K~AM 컬럼처럼 주차별 누적 % 추이는 1차 구현에서 제외하고, "마감일 기준 진척" 표시는 Plan/Actual 합계만으로 시작. 이후 별도 차트로 확장.

---

## 4. MdrSummaryPanel 재설계

`src/components/mdr/MdrSummaryPanel.tsx` 전체 재작성. 4개 카드:

```
┌─────────────────────────────────────────────────────────┐
│ KPI: Overall Progress (큰 숫자)                          │
│      + Block별 카드 (SMP&CCM 22.9%, HSM 22.7%, ...)      │
│      + 도면 합계 / 완료 합계                              │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Block × Discipline × Stage 매트릭스 표                   │
│ 컬럼: SD Plan/Actual/% | DD Plan/Actual/% | CD Plan/A/% │
│ Sub-total(Block) / Total 행 자동 계산                    │
│ 합산 제외(GEN) 행은 회색 처리, "플랜트 합산제외" 배지    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ WF 패널 (Stage / Discipline / Building)                  │
│ 읽기 전용 표시, "Admin에서 수정" 링크                    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 임포트 로그 (기존 유지)                                  │
└─────────────────────────────────────────────────────────┘
```

스냅샷 카드는 일단 제거(자동 계산이므로 의미 약함). 필요 시 일별 Overall 스냅샷을 cron으로 별도 적재.

---

## 5. 작업 순서 (커밋 단위)

1. **정리 커밋**: summaryParser.ts 삭제, MdrImportDialog SUMMARY 분기 제거, `DROP TABLE mdr_summary_matrix` 마이그레이션
2. **WF 모듈**: `src/lib/mdr/weights.ts` 상수 + DB 로더 hook (`useMdrWeights`)
3. **계산 엔진**: `src/lib/mdr/summaryEngine.ts` + `useMdrSummary` hook
4. **패널 재작성**: `MdrSummaryPanel.tsx`
5. **Admin 편집 UI**: `MdrWeightsEditor.tsx` 확장 + Admin 페이지에 노출

---

## 기술 메모

- 모든 계산은 client-side(React Query) — 도면 수 수천 건 수준이라 충분히 빠름
- 캐시 키는 `["mdr_summary", buildingFilter?]` 식으로 무효화 가능
- GEN 블록 처리: `BUILDING_WF`에 GEN이 없으면 Overall 계산에서 자연스럽게 제외. 단, 매트릭스 표에는 표시(투명도 50% + "합산제외" 배지)
- MAIN_OFFICE는 SD 단계 없음 → Stage 마일스톤이 없는 경우 Plan=0이 되어 자동 처리됨
- FAFP/CIVIL 등 ARCH/STR/MECH/ELEC 4개 표준에 없는 discipline이 GEN에만 있음. Discipline WF에 FAFP=0.10, CIVIL=0 추가해 호환
