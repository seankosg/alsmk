
# MDR 파서 재설계 (SHAW 멀티 서브컬럼 지원)

## 배경
현재 `src/lib/mdr/parser.ts`의 `MILESTONE_RE`는 마일스톤 라벨(SD30%/DD30%/CD30% 등) 1개당 1개 컬럼만 매핑한다. 그러나 SHAW MDR(`03_HSM_MDR_progress.xlsx`)은 마일스톤 1개가 **여러 서브컬럼(Plan/Actual × 단계 수)** 으로 펼쳐져 있어, DD/CD 합계가 100%가 되지 않고 경고가 발생한다.

## 변경 범위
편집 파일: `src/lib/mdr/parser.ts`, `src/lib/mdr/validator.ts` (사이드이펙트 정리만)
변경 없음: `importRunner.ts`, UI, DB 스키마, columnMap.

## 새 파싱 로직 (parser.ts)

### 1. 마일스톤 라벨 → 컬럼 범위 묶기
- `MILESTONE_RE` 로 매칭된 셀을 발견하면, **다음 마일스톤 라벨(또는 비-마일스톤 헤더) 직전까지의 모든 컬럼**을 같은 마일스톤의 서브컬럼 그룹으로 묶는다.
- 병합셀(merged cells, `ws['!merges']`)을 보조 신호로 사용해 라벨이 차지하는 가로 범위를 정확히 식별한다. merge 정보가 없는 경우는 순차 스캔으로 폴백.

### 2. incrementPct 합산
- 그룹 내 모든 서브컬럼의 incrementRow 값을 **합산**하여 마일스톤의 최종 `incrementPct` 로 사용.
  - 예: DD30%가 4개 서브컬럼(5%·5%·5%·5%) → 20%가 아니라 그룹 전체로 누적, 다른 DD 그룹과 합쳐 100% 검증.
- 단, SHAW 템플릿이 서브컬럼별 가중치를 따로 가질 경우(예: 75/80%) 그 값도 합산된다. 이는 의도된 동작.

### 3. planDate
- 그룹 내 서브컬럼들의 planDate 중 **가장 늦은 날짜**를 그 마일스톤의 planDate 로 사용 (없으면 undefined).

### 4. progress(달성여부)
- 행 데이터에서 그룹 내 **어느 서브컬럼이라도 `isYes`** 면 해당 마일스톤은 `isDone = true`.
- 부분 완료 비율이 필요하면 차후 확장 포인트로 남기되, 이번 변경에선 Boolean 유지(스키마 호환).

### 5. milestoneLabelRow 탐지
- 기존 로직(headerRow ~ headerRow+2 중 매칭 최다 행) 유지하되, 서브컬럼이 많아진 SHAW 파일에서도 그대로 동작.

## 변경 의사 코드
```text
groups = []
c = noCol
while c <= maxCol:
  label = cell(milestoneLabelRow, c)
  m = MILESTONE_RE.match(label)
  if m:
    start = c
    c++
    # 다음 라벨 또는 비어있지 않은 다른 헤더 직전까지 같은 그룹
    while c <= maxCol and !isNewMilestoneOrHeader(c):
      c++
    end = c - 1
    groups.push({stage, pct, cols: [start..end]})
  else:
    headers.push(c); c++

for g in groups:
  incrementPct = sum(parseFloat(cell(incrementRow, x)) for x in g.cols)
  planDate     = max(parseDate(cell(planDateRow, x)) for x in g.cols)
  // 행 진행도: any(isYes(cell(r, x)) for x in g.cols)
```

`isNewMilestoneOrHeader(c)` 기준:
- `MILESTONE_RE.test(cell(milestoneLabelRow, c))` → 새 그룹 시작
- 또는 `cell(headerRow, c)` 가 비어있지 않고 식별 컬럼으로 분류 가능 → 그룹 종료

## validator.ts
재설계 후 DD/CD 합계가 100% 근처로 정상화되므로 별도 수정 없음. autoFix 폴백 로직은 그대로 유지.

## 검증 절차 (빌드 모드에서 수행)
1. `03_HSM_MDR_progress.xlsx`를 임시 Node 스크립트로 신규 파서에 통과시켜 시트별 DD/CD 합계 출력 → 100±1 인지 확인.
2. 기존 정상 파일(`01_GEN`, `02_SMP&CCM`)도 회귀 확인 — 단일 컬럼 케이스도 그룹화 로직에서 길이 1 그룹으로 자연 처리.
3. UI 임포트 흐름 (`/design/import`) Playwright 로 헤드리스 임포트 후 경고 0건 확인.

## 영향 / 리스크
- DB 스키마 변경 없음. progress는 여전히 boolean.
- 기존 정상 파일은 그룹 길이 1이라 동작 동일.
- 서브컬럼 weight 합이 100을 명백히 초과하는 비정상 템플릿은 여전히 validator 경고가 뜨며, 이는 데이터 문제로 사용자에게 노출.
