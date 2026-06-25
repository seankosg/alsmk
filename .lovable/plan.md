## 목표

Monitor 패널 진도율에 Summary와 동일한 WF(가중치) 로직을 적용하고, 상단에 **"WF 적용 / 미적용" 토글 버튼**을 추가합니다. 기본값은 **WF 적용**.

향후 Summary 테이블의 중복 기능 통합을 위한 첫 단계입니다.

---

## 변경 사항

### 1. `src/lib/mdr/milestoneMonitorEngine.ts`

기존 `MonitorCell { plan, actual, delta }` 는 **도면 단순평균** 값 (= WF 미적용). 여기에 가중치 적용 값을 추가로 계산해 함께 저장합니다.

- `MonitorCell` 확장:
  - `plan`, `actual`, `delta` (기존 단순평균 — 미적용 모드용, 유지)
  - `planW`, `actualW`, `deltaW` (신규 — WF 적용 모드용)
- WF 로드: `loadMdrWeights()` 호출. FAFP discipline은 `FAFP_STAGE_WF`, 그 외는 `wf.stage` 사용 (Summary와 동일).
- WF 적용 계산 단위:
  - **마일스톤 셀(stage,pct,planDate)** 의 P/A 자체는 도면 단순평균이지만, Overall Progress의 SD/DD/CD P/A는 `wf.stage` 가중평균으로 산출.
  - row의 Total/Overall은 추후 통합 시 building·discipline WF로 확장 가능하도록 row 구조에 `discProgressW` (해당 row discipline 가중 진도율) 필드 추가.
- `MonitorMatrix`에 `wf: MdrWfBundle` 포함 → UI에서 모드 전환 시 재계산용.
- snapshot 저장(`mdr_milestone_snapshots`)은 기존 단순평균 값만 저장 (스키마 변경 없음). WF 적용 값은 클라이언트에서 즉시 계산 가능하므로 컬럼 추가 불요.

### 2. `src/components/mdr/MdrMilestoneMonitorPanel.tsx`

- 상단 툴바에 **WF 토글 버튼** 추가:
  - shadcn `Switch` + 라벨 "WF 적용" (좌측 정렬, asOf 컨트롤 옆)
  - `useState<boolean>(true)` (기본 적용)
  - localStorage에 사용자 선택 영속화 (`mdr.monitor.wfEnabled`)
- 표시 분기:
  - WF 적용 ON → cell의 `planW/actualW/deltaW`
  - WF 적용 OFF → 기존 `plan/actual/delta`
- Overall Progress 컬럼의 SD/DD/CD P/A 값도 동일 분기 적용.
- 토글 상태에 따라 헤더에 **`WF 적용`** / **`WF 미적용`** 배지 표시 (색상 구분).

### 3. 검증

`/design/summary`에서:
1. 토글 ON(기본) → Monitor의 Overall Progress P/A가 Summary 테이블 Stage 합계와 근접하게 일치하는지 확인.
2. 토글 OFF → 기존(도면 단순평균) 값으로 변하는지 확인.
3. localStorage에 값 영속화 후 새로고침 시 유지되는지 확인.

---

## 변경 파일

- `src/lib/mdr/milestoneMonitorEngine.ts` (셀 구조 확장 + WF 가중 계산 추가)
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` (토글 UI + 표시 분기)

DB/마이그레이션 변경 없음. Summary 통합 작업은 후속 단계에서 진행.