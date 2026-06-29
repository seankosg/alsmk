## 확인된 원인

엑셀 파싱과 DB 저장은 정상입니다. SMP&CCM ARCH 예시 기준 DB의 `mdr_milestone_cells` 에는 DD 셀이 모두 저장되어 있었습니다.

누락의 실제 원인은 진도율 패널(`MdrMilestoneMonitorPanel`)이 컬럼을 만들 때 `mdr_milestones`(그룹 단위, DD30/60/90/100 형태로 합쳐진 행)만 참조하기 때문입니다. 그 결과 같은 pct 안에 들어 있는 여러 셀이 한 컬럼으로 접혀 보입니다.

```text
DB 저장 단위 (셀):
mdr_milestone_cells = (stage, pct, sub_idx, plan_date, increment_pct, label?)

패널 컬럼 단위 (그룹):
mdr_milestones = (stage, pct, plan_date, increment_pct)
→ pct 당 1개로 합쳐져 sub_idx 정보가 사라짐
```

## 수정 목표

진도율 패널 컬럼을 셀 단위로 표시합니다. **셀 개수는 어디에도 하드코딩하지 않고**, 파일/시트/단계마다 `mdr_milestone_cells` 에 저장된 셀을 그대로 컬럼화합니다.

- 단계별 셀 수는 파일/시트/단계에 따라 다를 수 있음 (4, 5, 6, 10, 15 등 가변)
- 같은 단계라도 도면마다 셀 수/날짜가 다를 수 있음
- 진도 계산은 현재 요청대로 **셀 누적 방식 유지**(`dd_weight` 방식으로 바꾸지 않음)

## 구현 계획

### 1. 패널 컬럼 키를 셀 단위로 변경

`src/lib/mdr/milestoneMonitorEngine.ts`

- `MonitorMilestoneKey` 에 `subIdx`, `incrementPct`, `label` 추가
- key 식별자 확장

```text
기존: stage | pct | planDate
변경: stage | pct | subIdx | planDate
```

- 컬럼 수집 소스를 `d.mdr_milestones` → `d.mdr_milestone_cells` 로 교체
- 셀 수 상수/배열/하드코딩 없음. 단순 순회로 수집
- 매트릭스 전체에서 등장한 셀의 **합집합**을 컬럼으로 사용(도면마다 셀 수가 달라도 정상 동작)
- 정렬: `stage → pct → subIdx → planDate`

### 2. 셀 단위 P/A 계산

`src/lib/mdr/progressEngine.ts`

- `actualPctUpTo()` 에 선택 인자 `subIdx?: number` 추가
  - 지정 시 동일 stage 의 `(pct, subIdx) ≤ 인자` 셀 increment 합산
  - 미지정 시 기존 pct 단위 동작 유지 (다른 호출부 영향 없음)
- 신규 `drawingCellPlannedPct(cells, stage, pct, subIdx, asOf, prevStageLastPlanDate?)`
  - 동일 stage 셀들을 `plan_date` 오름차순으로 정렬해 누적
  - 단계 첫 셀 시작일은 직전 stage 마지막 plan_date(없으면 첫 셀 −7일)
  - 셀 구간 내부는 일일 선형 보간

도면이 어떤 셀 개수를 가지더라도 동일 함수로 처리됩니다.

### 3. 스냅샷 테이블 확장

DB migration 추가:

- `mdr_milestone_snapshots.sub_idx INTEGER` 컬럼 추가
- 중복 기준을 `(as_of, building, discipline, stage, pct)` → `(as_of, building, discipline, stage, pct, sub_idx)` 로 확장
- `saveSnapshot()` payload 에 `sub_idx` 포함

기존 스냅샷은 그룹 단위이므로 마이그레이션 후 첫 Recompute 시 셀 단위로 다시 저장됩니다.

### 4. 패널 UI

`src/components/mdr/MdrMilestoneMonitorPanel.tsx`

- 헤더는 2단 구조 유지
  - 상단: 그룹 라벨(DD30/DD60/DD90/DD100 등 — 현재 pct 별로 동적 생성되므로 그대로 동작)
  - 하단: 셀별 plan_date 라벨
- 그룹의 colSpan 은 현재 매트릭스에 들어온 해당 그룹 셀 수로 동적 계산
- 컬럼 key 를 `sub_idx` 포함 값으로 변경하여 같은 pct 의 셀들이 서로 덮어쓰지 않도록 처리

### 5. 재발방지 테스트

`src/lib/mdr/progressEngine.test.ts` 및 (필요 시) `milestoneMonitorEngine` 용 테스트

- 셀 수가 가변임을 전제로 한 일반 케이스로 작성. 특정 숫자 하드코딩 금지
- 검증 항목
  - 임의의 셀 배열(예: DD pct=30 셀 N개, pct=60 셀 M개)을 입력했을 때, 매트릭스 컬럼 수 = 셀 합계와 같아지는지
  - `actualPctUpTo(..., subIdx)` 가 셀별로 정확히 누적되는지
  - 기존 pct 단위 호출은 결과가 변하지 않는지
  - 도면마다 셀 수가 다른 경우에도 합집합으로 모든 셀 컬럼이 살아남는지

### 6. 검증

- 다양한 시트(ARCH/STR/MECH/ELEC 등)에서 패널 컬럼 수가 엑셀 셀 수와 일치
- 같은 단계 안 셀 수가 도면별로 달라도 누락 없이 표시
- Raw Data 그리드, DD weight 기반 stage 합계, Overall, WF 토글 영향 없음

## 변경 파일

- `src/lib/mdr/milestoneMonitorEngine.ts`
- `src/lib/mdr/progressEngine.ts`
- `src/lib/mdr/progressEngine.test.ts`
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- `supabase/migrations/*_add_sub_idx_to_mdr_milestone_snapshots.sql`

## 재발방지 원칙

진도율 패널의 마일스톤 컬럼은 항상 `mdr_milestone_cells` 를 1차 소스로 사용합니다. `stage + pct` 만으로 key 를 만드는 코드는 금지(같은 pct 안에 sub_idx 별로 다른 plan_date/increment 가 존재할 수 있음). 셀 개수에 의존하는 상수/배열을 도입하지 않습니다.