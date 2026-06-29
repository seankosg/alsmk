# 엑셀 TOTAL DD WEIGHT 도입 — 도면별 DD 가중치 기반 진도

## 목표
엑셀 SUMMARY 의 `DD CURRENT STATUS (%)` 합계와 앱의 DD 진도가 **정확히 일치**하도록, 각 건물 MDR 시트의 `TOTAL DD WEIGHT VALUE (%)` 컬럼(도면별 0~1 가중치, 시트 합=1)을 별도 필드로 파싱·저장하고 진도 계산에 직접 반영합니다.

## 핵심 원리 (엑셀 방식)
```text
도면별 DD 진도(%)  = dd_weight × (DD 완료 = 1, 미완료 = 0) × 100
Discipline DD%    = Σ(dd_weight × done) over 해당 discipline 도면
                    (가중치 자체가 시트 내 합=1 이므로 나눗셈 불필요)
```
즉 도면 하나의 DD 진도는 그 도면 weight 값 그대로(예: 0.05 → 5%), Discipline / Block 합계는 단순 합산.

## 작업 항목

### 1. DB 스키마 (migration)
- `mdr_drawings.dd_weight numeric(10,8)` 컬럼 추가 (nullable, 기본 NULL).
- 인덱스 불필요 (집계는 building_code+discipline 으로 이미 인덱스됨).

### 2. 파서 (`src/lib/mdr/parser.ts`)
- 헤더 탐지에 `TOTAL DD WEIGHT` 별칭 추가 → 신규 컬럼키 `ddWeight` 매핑.
- `MdrParsedRow` 에 `ddWeight: number | null` 필드 추가.
- 셀값 정규화: 숫자면 그대로, "5.0%" / "5%" 텍스트면 /100 처리 후 0~1 범위로 저장.

### 3. 컬럼맵 (`src/lib/mdr/columnMap.ts`)
- `MDR_COLUMN_MAP` 에 `ddWeight: { header: "TOTAL DD WEIGHT VALUE (%)", source: "original", preserveOnReimport: true }` 추가.
- 헤더 별칭에 `"total dd weight"`, `"total dd weight value (%)"`, `"total dd weight \nvalue (%)"` 등록.

### 4. Import 파이프라인 (`src/lib/mdr/importRunner.ts`)
- `persistParsed` 의 `mdr_drawings` upsert payload 에 `dd_weight` 포함.
- 재임포트(merge) 시 NULL 이면 기존값 유지(coalesce), 값이 들어오면 덮어쓰기.

### 5. 진도 엔진 — Raw Data 그리드 (`src/lib/mdr/progressEngine.ts`)
- `drawingStagePct(drawing, "DD")` 분기 추가:
  - `drawing.dd_weight != null` 인 경우: DD stage 의 **마지막 마일스톤 셀(done=true)** 여부로 판정 → `done ? dd_weight*100 : 0` 반환.
  - 없으면 기존 로직(`increment_pct × is_done`) 유지.
- 단위 테스트(`progressEngine.test.ts`)에 dd_weight 분기 케이스 2건 추가.

### 6. Summary 패널 (`src/components/mdr/MdrMilestoneMonitorPanel.tsx` & `summaryEngine.ts`)
- 도면별 DD% 가 이미 (5) 에서 weight 기반으로 나오므로, Discipline DD% 집계를 **평균 → 합산**으로 변경 (`variant === "DD"` 분기).
  - SD/CD 는 기존 평균 유지.
- WF 토글 OFF/ON 모두 동일하게 합산 (도면 weight 자체가 가중).

### 7. 검증
- SMP&CCM × STR × DD: 엑셀 시트의 `DD CURRENT STATUS (%)` 합계와 패널 표시값이 ±0.1% 이내 일치하는지 SQL + UI 비교.
- 재임포트 1회 후에도 dd_weight 보존 확인.

## 비범위 (변경 없음)
- SD/CD weight 컬럼 (엑셀에 존재하지 않음 — 현재 평균 방식 유지)
- Excel exporter (raw_row_cells 로 이미 보존됨, 별도 컬럼 추가는 후속)
- `mdr_weights` 테이블 (Team/Building/Stage WF 는 그대로)

## 변경 파일 요약
| 파일 | 변경 |
|---|---|
| migration | `mdr_drawings.dd_weight` 컬럼 추가 |
| `src/lib/mdr/columnMap.ts` | ddWeight 헤더/별칭 |
| `src/lib/mdr/parser.ts` | ddWeight 셀 파싱·정규화 |
| `src/lib/mdr/importRunner.ts` | dd_weight upsert |
| `src/lib/mdr/progressEngine.ts` | DD 분기 (weight 우선) |
| `src/lib/mdr/progressEngine.test.ts` | 케이스 추가 |
| `src/lib/mdr/summaryEngine.ts` | DD Discipline 집계 = 합산 |
| `src/integrations/supabase/types.ts` | 자동 재생성 |
