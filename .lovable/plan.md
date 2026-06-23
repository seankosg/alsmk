## Progress Icon 세부 마일스톤 기준 수정 계획

### 문제
현재 `src/lib/mdr/progressIcon.ts` 의 `buildMdrProgressIconCells()` 는 각 마일스톤 그룹(예: DD60) 자체의 완료 여부만 보고 `done / delay / planned` 를 판단합니다.

하지만 MDR progress icon은 사용자가 말씀하신 것처럼 **공정실제진행율의 누적 위치**를 기준으로 표시되어야 합니다.

예: SMP&CCM / ARCH / No.1
- 계획: DD30 완료, DD60 기준 계획 약 57%
- 실적: DD60 누적 50%
- 따라서 DD30은 완료, **DD60은 지연**, DD90은 아직 planned/empty 성격이어야 함
- 현재는 DD60 그룹 자체 셀들이 모두 완료된 것으로 판정되어 DD60이 `done`, 다음 DD90이 `delay` 로 밀려 표시됨

### 수정 방향
Progress Icon 상태를 “그룹별 단순 완료”가 아니라 **세부 마일스톤의 누적 계획률(P)과 누적 실적률(A)** 로 판정하도록 변경합니다.

각 pip(DD30, DD60, DD90, DD100, CD30...) 별로 다음 값을 계산합니다.

```text
누적 계획률 P = 해당 세부 마일스톤까지의 planned %
누적 실적률 A = 해당 세부 마일스톤까지 완료된 실제 increment 합계
```

상태 판정:
```text
1) 해당 단계/마일스톤이 없거나 scope 밖이면 empty
2) A >= pip 기준 누적 목표율이면 done
3) P > A 이고 asOf 기준 그 pip 계획 구간에 진입했으면 delay
4) 직전 pip가 done이고 현재 pip가 진행 중이면 wip
5) 그 외 planned
```

### 구현 상세

#### 1) `progressIcon.ts` 로직 재작성
- 기존 `classify()` 와 `groupCellsDone()` 중심 로직을 누적 기준으로 교체합니다.
- `cells` 가 있으면 `mdr_milestone_cells` 의 `incrementPct` 단위로 누적 실적(A)을 계산합니다.
- `cells` 가 없는 레거시 데이터는 기존 `mdr_progress` 그룹 단위 완료 여부로 fallback 합니다.
- 각 pip마다:
  - `targetActual`: 해당 pct까지의 누적 increment 합
  - `actualToPct`: 해당 pct까지 완료된 increment 합
  - `plannedToPct`: `drawingMilestonePlannedPct()` 로 계산한 해당 pct 기준 계획률
  - `state`: 위 판정식으로 결정

#### 2) No.1 케이스 기대 결과
SMP&CCM / ARCH / `L2Z1-800-EA100-001-B`
- SD: done
- DD30: done
- DD60: delay (계획 약 57, 실적 50)
- DD90: planned 또는 아직 비활성에 가까운 상태
- DD100: planned
- CD: planned/empty 성격

즉, 화면처럼 “DD60 done + DD90 delay”가 아니라 **DD60 자체가 delay** 로 표시되도록 수정합니다.

#### 3) Tooltip 개선
가능하면 tooltip에도 pip별 판정 근거가 보이도록 다음 정보를 추가합니다.
```text
DD60: Delay (P 57 / A 50, plan 06-26)
```
기존 tooltip의 actual/plan 날짜 표시는 유지하되, P/A 값을 함께 보여 문제 확인이 쉬워지게 합니다.

#### 4) 호출부 유지
`MdrAdvancedGrid.tsx` 의 호출부는 이미 필요한 데이터(`ms`, `pgRaw`, `asOf`, `scope`, `cellRows`)를 전달하고 있으므로 큰 변경 없이 유지합니다.
필요하면 `progressIcon.ts` 내부 타입만 확장합니다.

### 검증
- SMP&CCM > ARCH > No.1 의 Progress icon이 DD60 지연으로 표시되는지 확인
- 같은 행의 단계별 DD-P/DD-A 값과 Progress icon 상태가 일치하는지 확인
- DD60이 100% 완료된 행은 DD60 done으로 유지되는지 확인
- 아직 계획일 전인 pip는 delay가 아니라 planned/wip로 표시되는지 확인
- 범위 밖 단계는 empty로 유지되는지 확인

### 변경 파일
- `src/lib/mdr/progressIcon.ts`
- 필요 시 `src/components/mdr/grid/MdrProgressIconCell.tsx` tooltip 표시만 보조 수정