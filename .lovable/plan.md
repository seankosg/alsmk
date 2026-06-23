
# 방식 A: 셀 단위(Sub-Column) Progress 모델 전환

엑셀의 각 마일스톤 그룹(예: DD60 = T·U·V·W 4셀)을 그룹 1행이 아닌 **셀 단위 N행**으로 저장하도록 Parser/DB/계산 로직 전반을 전환한다. 사용자 직관(“Y가 표시된 셀의 증분만 합산 = 실적”)과 시스템 계산이 1:1로 일치하게 만든다.

## 핵심 변경 모델

```text
[현재]                                 [변경 후]
mdr_milestones                         mdr_milestones (그대로, 그룹 메타)
 (drawing, stage, pct)                  (drawing, stage, pct) — increment_pct = 그룹 합
   increment_pct = 30                   plan_date = 그룹의 가장 늦은 plan_date
   plan_date                          
                                       mdr_milestone_cells (신규)
mdr_progress                            (drawing, stage, pct, sub_idx)
 (drawing, stage, pct)                  increment_pct (셀 단위), plan_date (셀 단위 옵션)
   is_done (그룹 OR)                 
                                       mdr_progress (셀 단위로 확장)
                                        (drawing, stage, pct, sub_idx)
                                        is_done, actual_date
```

## 단계별 작업

### 1) DB 마이그레이션
- 신규 테이블 `mdr_milestone_cells(id, drawing_id, stage, pct, sub_idx, increment_pct numeric(6,2), plan_date date, created_at)` + UNIQUE(drawing_id, stage, pct, sub_idx) + GRANT/RLS(`is_admin_or_pm`).
- `mdr_progress` 변경:
  - 컬럼 `sub_idx integer NOT NULL DEFAULT 0` 추가
  - UNIQUE 제약 `(drawing_id, stage, pct)` → `(drawing_id, stage, pct, sub_idx)` 로 교체
- `mdr_milestones.increment_pct`는 그룹 합으로 유지(요약/대시보드 호환), `plan_date`는 그룹의 가장 늦은 셀 plan_date 유지.
- 기존 데이터 백필: 모든 `mdr_milestones` 행에 대해 `mdr_milestone_cells (sub_idx=0, increment_pct=현재 increment_pct, plan_date=현재 plan_date)` 1행씩 시드. `mdr_progress`는 `sub_idx=0` 유지(기존 데이터 손상 없음).

### 2) Parser (`src/lib/mdr/parser.ts`)
- `MdrMilestoneDef` 확장: 그룹 메타 + `cells: { subIdx, incrementPct, planDate? }[]`.
- `MdrParsedRow.progress`를 그룹 단위 → **셀 단위 배열** `{ stage, pct, subIdx, isDone, actualDate? }[]` 로 변경.
- 그룹 내 “어느 셀이라도 Y면 그룹 done”(`some`) 로직 제거. 각 서브컬럼별 Y/N을 그대로 저장.
- `MdrMilestoneDef.incrementPct` (그룹 합)와 `cells` 모두 emit하여 DB의 두 테이블에 매핑.

### 3) ImportRunner (`src/lib/mdr/importRunner.ts`)
- 신규/Rev 갱신/skip_same_rev 재동기화 3경로 모두에서:
  - `mdr_milestones` insert는 그대로 (그룹 합·대표 plan_date)
  - `mdr_milestone_cells` insert 신규 추가 (셀 단위 행)
  - `mdr_progress` insert에 `sub_idx` 포함, 그룹 OR 대신 셀별 isDone 그대로 저장
  - 재동기화 시 두 자식 테이블(`mdr_milestone_cells`, `mdr_progress`) 모두 delete-then-insert
- `bulkEdit.applyMdrBulkDelete`도 `mdr_milestone_cells` 삭제 추가.

### 4) Progress Engine (`src/lib/mdr/progressEngine.ts`)
- 신규 타입 `MilestoneCellRow { stage, pct, subIdx, incrementPct, planDate? }`, `ProgressCellRow { stage, pct, subIdx, isDone, actualDate? }`.
- `actualPct(cells, progress, stage)`: `Σ cell.incrementPct WHERE matching progress.isDone`. **이것이 사용자 직관과 일치하는 핵심 변경.**
- `plannedPctAsOf(cells, stage, asOf)`: 셀 단위 plan_date로 일일 선형 보간 (셀 plan_date 없으면 그룹 plan_date 폴백).
- `drawingMilestonePlannedPct(stage, pct)`: 셀 단위 누적합으로 재정의 — 그룹 P = `Σ cell.increment × (셀별 elapsed_ratio)` (모든 셀 plan_date 동일 시 기존 로직과 동치).
- SD 특수 케이스(`return 100`) 유지 여부는 동일하게 두되, SD도 셀 단위 actual을 합산하여 “셀 단위 직관”에 정합.

### 5) Grid (`src/components/mdr/grid/MdrAdvancedGrid.tsx`)
- 쿼리에 `mdr_milestone_cells(*)` 조인 추가.
- `buildCell(stage, pct)` (그룹 셀 표시):
  - `aShow = Σ cells[g].increment WHERE 해당 progress.is_done`
  - `pShow = Σ cells[g].increment × cell_elapsed_ratio(asOf)` — 신규 엔진 호출
  - `Δ = pShow − aShow` (사용자 직관과 동일)
- `progressIcon.ts`도 셀 단위 progress로 입력 시그니처 변경 (그룹 done 판정 → 셀 합 ≥ 그룹 합 시 done).

### 6) Summary Engine (`src/lib/mdr/summaryEngine.ts`)
- `mdr_progress` 셀 단위 입력에 대응:
  - `actualAtDate(progress, stage, D)`: 기존 “최대 pct” 방식 → “셀 단위 increment 합”으로 변경하되, 마일스톤별 카운트(planCount/actualCount)는 그룹의 셀 합 ≥ 그룹 increment 일 때 “해당 마일스톤 달성”으로 판정.
- 단계 in_scope·집계 로직은 동일.

### 7) Snapshot (`mdr_snapshots`)
- 신규 데이터 모델 기반으로 재계산. 과거 스냅샷은 sub_idx=0 단일 셀로 백필되어 그대로 호환.

## 기술 세부 (개발자용)

### 마이그레이션 SQL 골자
```sql
CREATE TABLE public.mdr_milestone_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES public.mdr_drawings(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('SD','DD','CD')),
  pct integer NOT NULL CHECK (pct BETWEEN 0 AND 100),
  sub_idx integer NOT NULL,
  increment_pct numeric(6,2) NOT NULL DEFAULT 0,
  plan_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drawing_id, stage, pct, sub_idx)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_milestone_cells TO authenticated;
GRANT ALL ON public.mdr_milestone_cells TO service_role;
ALTER TABLE public.mdr_milestone_cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_milestone_cells admin/pm all" ON public.mdr_milestone_cells
  TO authenticated USING (is_admin_or_pm(auth.uid())) WITH CHECK (is_admin_or_pm(auth.uid()));
CREATE INDEX idx_mdr_milestone_cells_drawing ON public.mdr_milestone_cells(drawing_id);

-- 백필
INSERT INTO public.mdr_milestone_cells (drawing_id, stage, pct, sub_idx, increment_pct, plan_date)
SELECT drawing_id, stage, pct, 0, increment_pct, plan_date FROM public.mdr_milestones;

-- progress 확장
ALTER TABLE public.mdr_progress ADD COLUMN sub_idx integer NOT NULL DEFAULT 0;
ALTER TABLE public.mdr_progress DROP CONSTRAINT mdr_progress_drawing_id_stage_pct_key;
ALTER TABLE public.mdr_progress ADD CONSTRAINT mdr_progress_drawing_stage_pct_sub_key
  UNIQUE (drawing_id, stage, pct, sub_idx);
```

### 영향 파일
- `supabase/migrations/<new>.sql`
- `src/lib/mdr/parser.ts` — `MdrParsedRow.progress` 시그니처 변경
- `src/lib/mdr/importRunner.ts` — 3개 insert 경로 + cells 테이블 추가
- `src/lib/mdr/bulkEdit.ts` — cells delete 추가
- `src/lib/mdr/progressEngine.ts` — 셀 기반 계산 함수
- `src/lib/mdr/summaryEngine.ts` — actualAtDate 셀 합 방식
- `src/lib/mdr/progressIcon.ts` — 셀 입력 대응
- `src/components/mdr/grid/MdrAdvancedGrid.tsx` — 쿼리·buildCell 변경
- `src/integrations/supabase/types.ts` — 자동 재생성

### 검증
- 기존 import된 도면(빌딩 1~2개)에 대해 셀 백필 후 그리드 P/A 값이 기존 계산과 동일한지 확인 (sub_idx=0만 있으므로 동치여야 함).
- R13(Arch) 도면 재임포트 후 DD60 셀이 P=20·A=20 (또는 plan_date에 따른 보간값) 으로 표시되는지 검증.
- Summary 페이지의 전체 진도율이 ±0.5%p 이내로 안정.

### 마이그레이션 안전성
- 백필이 동치값을 보장(`sub_idx=0`, 동일 increment)하므로 **재임포트 전까지 기존 사용자 화면은 변동 없음**. 신규 import 시점부터 셀별 정밀 계산이 활성화됨.

## 작업 추정
약 2~3 작업일 (마이그레이션 0.5d · Parser/Importer 1d · Engine/Grid 1d · 검증 0.5d).
