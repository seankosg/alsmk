## Overall 컬럼 2단 구조화 + 단계 P 0% 버그 수정

이전 메시지에서 보고된 "DD-P 가 0 으로 표시" 버그와 이번 Overall 2단화 요구는 같은 코드 블록을 건드리므로 한 번에 처리합니다.

### 1) 단계/Overall 계획률(P) 0 표시 버그 수정

원인: `MdrAdvancedGrid.tsx` 의 row 빌드 useMemo 에서 progress 엔진 호출 시 **DB 원본(snake_case) 배열인 `ms` 를 그대로** 전달. 엔진은 `planDate`, `incrementPct` (camelCase) 를 기대하므로 `plannedPctAsOf` 의 필터(`m.planDate`)에서 모두 누락 → 계획률 0.

수정: `msRows` 정규화 선언을 위로 올리고, 아래 4개 호출을 모두 `msRows` 로 통일.

```ts
// 275~278 → 다음과 같이
const msRows = ms.map((x: any) => ({
  stage: x.stage,
  pct: Number(x.pct),
  incrementPct: Number(x.increment_pct),
  planDate: x.plan_date ?? null,
}));
const sd = drawingStagePct(msRows, pgRows, "SD", asOf, cellRows);
const dd = drawingStagePct(msRows, pgRows, "DD", asOf, cellRows);
const cd = drawingStagePct(msRows, pgRows, "CD", asOf, cellRows);
const overall = drawingOverall(msRows, pgRows, asOf, { sd: 1, dd: 1, cd: 1 }, scope, cellRows);
```
(280~285 의 기존 `msRows` 선언은 제거)

검증 — 대상 도면 `L2Z1-800-EA100-001-B` (DD30 plan=5/29, DD60=6/26, DD90=7/31, DD100=8/14):
asOf=2026-06-23 기준 DD-P = 30 + 30×(25/28) ≈ **57** (현재 0 → 정상화).

### 2) Overall 을 2단 구조로 (Overall · P / A / Δ)

현재: 단일 leaf `overall_pct` (Overall%) 가 `overall.actual` 만 표시.
변경: SD/DD/CD 와 동일한 그룹 헤더 형태로 1단=Overall, 2단=P, A, Δ.

```text
┌────────── Overall ──────────┐
│   P    │    A    │    Δ    │
└────────┴─────────┴─────────┘
```

#### 2-1. row 데이터 (MdrAdvancedGrid.tsx ~389)
```ts
// 변경 전: overall_pct: overall.actual,
overall_p: overall.planned,
overall_a: overall.actual,
overall_d: overall.actual - overall.planned,
```

#### 2-2. 타입 (columns.tsx 65)
```ts
// overall_pct: number;
overall_p: number;
overall_a: number;
overall_d: number;
```

#### 2-3. 컬럼 정의 (columns.tsx 525~530)
기존 `accessorKey: "overall_pct"` 단일 컬럼을 다음 그룹으로 교체:
```ts
{
  id: "overall_group",
  header: "Overall",
  columns: buildOverallTrioCols(deltaCls),
},
```
`buildOverallTrioCols` 는 `buildStageTrioCols` 와 동일 패턴(P/A/Δ)이되 accessor 가 `overall_p/_a/_d` 를 가리키도록 추가. (간단히 `buildStageTrioCols` 에 4번째 키 "overall" 을 허용하도록 `Stage` 타입 확장 + accessor key 분기로 처리)
- P: 회색 정수, A: 본문색 정수, Δ: `deltaCls` 색상 (+/−)
- 각 컬럼 size 60, sortable, progress filter 동일

#### 2-4. Export 라벨 / 포맷 (MdrAdvancedGrid.tsx 575, 609)
- `headerLabel` base map 변경:
  ```ts
  // overall_pct 제거
  overall_p: "Overall P",
  overall_a: "Overall A",
  overall_d: "Overall Δ",
  ```
- `formatCell` 정규식 확장: `/^(sd|dd|cd|overall)_(p|a|d)$/` — 기존 P/A/Δ 처리 분기에 overall 포함되어 자연 처리됨. 기존 `if (id === "overall_pct") return formatPct(value);` 라인 제거.

#### 2-5. 기본 표시 / 영속 상태
- Overall 그룹은 기본 표시(visible). SD 트리오처럼 자동 숨김 처리는 하지 않음.
- 기존 저장된 `columnVisibility` 에 `overall_pct` 키가 있을 수 있으나, validColumnIds 에 없으면 pruneRecord 가 자동 제거하므로 무해.
- `columnOrder` 도 `defaultLeafOrder` 재산출 시 `overall_pct` 사라지고 `overall_p/_a/_d` 가 새 위치(기존 위치)에 삽입됨.

### 영향 / 회귀 점검
- 단계 트리오(SD/DD/CD-P) 모두 정상 계산 표시 (이번 1번 수정 효과).
- Overall 그룹 하단에 P/A/Δ 3컬럼 정상 표시, 정렬/필터 동작.
- Raw Data 내보내기 헤더에 "Overall P / Overall A / Overall Δ" 컬럼이 그대로 출력.
- Template 내보내기는 영향 없음 (해당 컬럼 미사용).
- 임의 5개 도면(분야별)에 대해 P/A/Δ 가 엑셀의 weight·plan_date 기반 계산과 일치하는지 sanity check.

### 변경 파일
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`
- `src/components/mdr/grid/columns.tsx`
