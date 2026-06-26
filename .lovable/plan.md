## 목표

진도율 패널에서 STR(구조) 부문 DD 단계 Actual이 0%로 표시되는 문제를 해결하여, 엑셀 STR 시트의 "Design Development" 영역(Information / STR Analysis / Drawings 그룹)이 진척률에 반영되도록 합니다.

## 배경

- 엑세 STR 시트의 DD 단계는 표준 DD30/60/90/100 마일스톤 컬럼이 없습니다.
- row 4: 단일 병합 헤더 `Design Development`
- row 5: 3개 라벨 그룹 — `Information`, `STR Analysis`, `Drawings` ("Progress"는 제외)
- row 6: 셀별 증분 (0.2 / 0.05~0.08×N / 0.05×4) — 합계 ≈ 1.0
- row 7: 셀별 plan_date
- row 8 이하: `Y`/공란으로 셀 단위 실적 표시

이 구조를 `mdr_milestone_cells`(stage='DD', pct, sub_idx, increment_pct, plan_date)로 적재하고 진척 계산은 기존 셀 단위 로직(`actualPct`)을 그대로 사용합니다.

## 진단 결과

| 빌딩/부문 | SD cells | DD cells | CD cells |
|---|---|---|---|
| SMP&CCM/STR | 176 | **0** | 2,442 |
| HSM/STR | 88 | **0** | 2,178 |
| CRM/STR | 242 | **0** | 4,411 |
| MAIN_OFFICE/STR | 14 | 200 | 256 (정상) |

`src/lib/mdr/parser.ts` 319-377 의 "STR DD 스타일 보강" 블록은 이미 다음을 수행합니다:
- row 4의 "Design Development" 텍스트로 DD region 감지
- region 안에 표준 MILESTONE_RE 그룹이 없으면 row 5의 라벨로 그룹화 (Progress 제외)
- 그룹 수에 따라 `STAGE_UNLABELED_PCTS`로 누적 pct 부여 — 3그룹이면 `[30, 60, 100]`
- 각 셀에서 row 6 증분 > 0 인 것만 sub_idx 부여하여 `cells[]`에 적재

따라서 코드는 **이론상 이미 동작 가능**합니다. 결론적으로 SMP/HSM/CRM의 STR 시트는 이 보강 로직이 추가되기 전(또는 다른 헤더 인식 실패 조건)에 import 되어 DD가 비어있을 가능성이 큽니다.

## 작업 단계

### 1. 파서 검증 (코드 1줄 추가 없이)
- 단위 테스트 추가: `src/lib/mdr/progressEngine.test.ts` 옆에 `parser.str.test.ts`를 만들어 이번에 업로드된 `02_SMP&CCM_MDR progress.xlsx`의 STR 시트를 파싱하고 다음을 검증:
  - DD 그룹 3개(pct=30/60/100, label=Information/STR Analysis/Drawings) 생성
  - 각 그룹의 `cells[].incrementPct` 합이 row 6 합계와 일치
  - 각 그룹의 `cells[].planDate`가 row 7 최신 일자와 일치
  - 행 단위 progress가 'Y' 표시 셀과 동일한 sub_idx 매칭

### 2. parser.ts 보정 (테스트 결과에 따라 선택적)
실패 시 다음만 손봅니다 (영역은 모두 319-377줄 보강 블록 내부):
- a. region 내부 라벨이 0개인 케이스 방어 (이미 처리됨)
- b. row 5 라벨이 한 칸만 차지하고 row 6에 다중 셀 증분이 있는 케이스에 대해 라벨 그룹의 cols 확장 (현재 빈 칸일 때 curLabel 유지하므로 동작 — 재확인)
- c. "Progress" 외 추가로 제외해야 할 라벨 토큰이 있다면 `isProgressLabel` 확장
- d. 라벨이 1개인 케이스(STR 일부 빌딩)에서도 `STAGE_UNLABELED_PCTS[1] = [100]` 대신 단일 누적으로 셀별 증분을 그대로 사용하도록 검토

### 3. 재import 실행
- `/design/import` 화면에서 SMP&CCM, HSM, CRM의 STR 시트만 재업로드
- import 후 DB 검증 쿼리:
  ```sql
  SELECT building_code, COUNT(*) FILTER (WHERE c.stage='DD') AS dd_cells
  FROM mdr_drawings d JOIN mdr_milestone_cells c ON c.drawing_id=d.id
  WHERE d.discipline='STR' GROUP BY 1;
  ```
  → 4개 빌딩 모두 > 0 인지 확인.

### 4. 진척 계산 일관성 확인
- `actualPct` 와 `actualPctUpTo` 는 셀 단위 모드에서 `(stage, pct, subIdx)` 정확 매칭으로 합산하므로 STR DD에서도 추가 변경 불필요.
- 단, `enforceSequential`이 STR 셀 단위 순서를 정상 처리하는지 점검 (sub_idx 정렬 기반이라 OK).

### 5. UI 패널 검증
- `/design/summary` 패널에서 다음과 같이 표시되는지 확인:
  | Block | Disc | DD Actual (기대) |
  |---|---|---|
  | SMP&CCM | STR | ≈ 43% (엑셀 0.4297) |
  | HSM | STR | ≈ 48% (0.4817) |
  | CRM | STR | ≈ 24% (0.2418) |
- SD Stage Actual 180% 오버플로 현상도 함께 해소되는지 확인 (DD 누락으로 인한 가중치 정규화 오류 가능성).

### 6. 회귀 방지
- 위 단위 테스트를 CI에 포함 (`vitest run`)
- STR 외에도 동일 패턴(라벨 그룹화)이 적용되는 시트(예: 향후 추가될 부문)에서도 깨지지 않도록 일반 케이스 테스트 1개 추가.

## 변경/영향 파일

- `src/lib/mdr/parser.ts` (필요 시 319-377 블록 미세 보정)
- `src/lib/mdr/parser.str.test.ts` (신규 — 단위 테스트)
- 코드 변경 없이 데이터 재import 만으로 해결될 가능성이 높습니다.

## 검증 기준

1. 단위 테스트 통과 — STR DD 3그룹이 30/60/100 pct로 적재됨
2. DB 쿼리 결과 — 4개 빌딩 STR 모두 DD cells > 0
3. UI 패널 — STR DD Actual 값이 엑셀 weekly progress 시트의 값(±0.5%p)과 일치
4. Overall Progress의 SMP&CCM/HSM/CRM 소계가 엑셀 값(31.22 / 31.78 / 27.13%)에 근사
