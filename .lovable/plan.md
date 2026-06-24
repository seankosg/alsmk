## 문제 재정의

현재 오류는 단순히 `DD60` 예시 하나가 아니라, **세부 마일스톤 pip(DD30/DD60/DD90/DD100/CD...)별 아이콘 판정에서 아직 계획일이 도래하지 않은 pip가 `delay` 로 표시되는 문제**입니다.

정확한 판정 기준은 다음이어야 합니다.

```text
1) 해당 pip가 자체 완료 목표까지 실적을 채웠으면 done
2) 해당 pip의 계획일이 지났고, 누적 A가 누적 P보다 낮으면 delay
3) 해당 pip의 계획일이 아직 미래이면 delay 금지
4) 미래 pip에 실적이 있으면 wip, 실적이 없으면 planned
```

## 원인

`src/lib/mdr/progressIcon.ts` 의 현재 로직은 `drawingMilestonePlannedPct()` 가 만든 **일일 보간 계획값**(`pipPlanned`)이 0보다 크면 해당 pip에 “계획이 진입했다”고 보고 있습니다.

이 때문에 실제 `planDate` 는 미래인데도, 직전 마일스톤~현재 마일스톤 사이 보간값이 조금이라도 발생하면 `delay` 로 분류됩니다.

## 수정 계획

### 1. `progressIcon.ts` 판정 기준 변경

`buildSeq()` 내부에서 각 pip마다 다음 값을 명확히 계산합니다.

- `pipDue`: `asOf >= ms.plan_date`
- `plannedCum`: 현재 기준 누적 계획률
- `actualCum`: 현재 기준 누적 실적률
- `pipTarget`: 해당 pip 자체 목표 increment

판정은 아래 순서로 고정합니다.

```text
if milestone 없음                         → empty
else if pipActual >= pipTarget             → done
else if pipDue && actualCum < plannedCum    → delay
else if actualCum > previousActualCum       → wip
else if pipDue                              → wip 또는 planned
else                                        → planned
```

핵심은 **`pipDue === false` 인 경우 절대 `delay` 가 나오지 않게 하는 것**입니다.

### 2. tooltip 근거 강화

각 아이콘 tooltip 에 다음 근거가 보이도록 유지/보강합니다.

- `P / A` 누적값
- `plan MM-DD`
- `delay` 인 경우에만 `overdue Nd`

### 3. 회귀 테스트 추가

`src/lib/mdr/progressIcon.test.ts` 를 추가해 여러 도면 케이스를 직접 검증합니다.

테스트 대상:

1. `DD30` 완료 → `done`
2. `DD60` 계획일 지남 + 누적 P > 누적 A → `delay`
3. `DD90` 계획일 미래 + 실적 없음 → `planned`
4. `DD100` 계획일 미래 + 실적 없음 → `planned`
5. 계획일 미래지만 보간 P가 일부 생기는 케이스 → `planned`, 절대 `delay` 아님
6. 계획일 미래 + 실적 일부 존재 → `wip`, 절대 `delay` 아님
7. 계획일 지남 + 누적 A가 누적 P 이상 → `wip` 또는 `done`, `delay` 아님
8. `CD` scope 제외 → `empty`
9. 셀 데이터 없는 레거시 진행 데이터 → 기존 그룹 완료 호환 유지
10. `summarizeGroupState()` 우선순위 → delay 포함 시 group delay 유지

### 4. 검증

수정 후 아래 테스트를 실행해 확인합니다.

```bash
bunx vitest run src/lib/mdr/progressIcon.test.ts
```

필요하면 `/design` 화면에서 SMP&CCM / ARCH 첫 행을 확인해:

- `DD60`: 지연 조건이면 `delay`
- `DD90` 이후 미래 계획: `planned`

으로 보이는지 검증합니다.

## 변경 파일

- `src/lib/mdr/progressIcon.ts`
- `src/lib/mdr/progressIcon.test.ts`