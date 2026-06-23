
# A + B + H 구현 계획 — Summary 매트릭스 마일스톤 타임라인, DWG 건수 Plan/Actual, FAFP 전용 WF

## 목표

1. **A. 마일스톤 타임라인 컬럼**: 각 Stage 안에 세부 마일스톤(SD50/100, DD30/60/90/100, CD30/60/100) 컬럼을 추가해서 "기준일 D 시점에 어느 마일스톤까지 계획/실적이 도달했는지" 한눈에 보이게.
2. **B. DWG 건수 Plan/Actual**: Stage별 Plan 도면수 / Actual 도면수를 % 옆에 정수로 표시.
3. **H. FAFP 전용 WF 변형**: 소방(FAFP)은 SD 없음 → DD/CD 50:50 Stage WF 적용. Discipline WF도 소방 제외 분야 합이 1이 되는 변형 셋(3.1) 옵션.

## 데이터 모델 변화

**없음.** 기존 `mdr_milestones`(stage, pct, plan_date) / `mdr_progress`(stage, pct, is_done, actual_date) / `mdr_weights` 그대로 사용. 마일스톤 셋이 이미 DB에 SD(50/100), DD(30/60/90/100), CD(30/60/100)로 표준화되어 있음.

## 산정 로직 변경 (`src/lib/mdr/summaryEngine.ts`)

### A. 마일스톤별 셀 산정
- 셀 단위 자료구조 확장:
  ```ts
  interface MilestoneCell {
    pct: number;          // 50, 100, 30 …
    planRatio: number;    // D 시점에 plan_date ≤ D 인 도면 비율 (0~1)
    actualRatio: number;  // D 시점에 actual & is_done 인 도면 비율
    planCount: number;
    actualCount: number;
  }
  interface StageCell {
    ...기존,
    milestones: MilestoneCell[];   // Stage별 마일스톤 시퀀스
  }
  ```
- 각 (building, discipline, stage)에 대해 in-scope 도면 N장 중, 해당 마일스톤(pct=M)이 plan_date ≤ D 인 도면 수(planCount) / actual_date ≤ D & is_done 인 도면 수(actualCount)를 집계. ratio = count / N.

### B. Stage별 Plan/Actual 도면 수
- 기존 `StageCell.plan/actual`(0~1 평균)은 유지.
- 추가:
  ```ts
  planCount: number;    // 해당 stage에서 "최소 1개 마일스톤이 D 이전" 인 도면 수
  actualCount: number;  // "최소 1개 마일스톤이 D 이전 완료" 도면 수
  ```
  → 엑셀의 "SD Plan / SD Actual" 도면 수와 일치하도록 정의.

### H. FAFP 전용 WF 변형
- `weights.ts`에 상수 추가:
  ```ts
  export const FAFP_STAGE_WF = { SD: 0, DD: 0.5, CD: 0.5 };
  export const DISCIPLINE_WF_NO_FAFP: Record<string, number> = {
    ARCH: 0.48, STR: 0.28, MECH: 0.11, ELEC: 0.13, FAFP: 0, CIVIL: 0,
  };
  ```
- `computeBlock`의 `discProgress` 계산에서 discipline이 FAFP면 `FAFP_STAGE_WF`로 가중 평균.
- Block progress 계산은 그대로(분야 WF는 기본 3.0 사용) — 엑셀 본 계산은 3.0 사용. 3.1 토글은 후속 단계로 보류.
- `mdr_weights`에 변형 셋이 들어 있으면 DB값이 우선 (기존 로딩 흐름 그대로).

## UI 변경 (`src/components/mdr/MdrSummaryPanel.tsx`)

### 매트릭스 헤더 재구성
- Stage 컬럼을 `[Plan #, Actual #, Progress %, M1, M2, …]` 형태로 확장.
- Stage 그룹 헤더 아래 2단:
  - 1단: SD / DD / CD
  - 2단(Stage 안): `Plan` `Actual` `%` `SD50%` `SD100%` (또는 DD30/60/90/100, CD30/60/100)
- 마일스톤 셀: 진척(actual ≥ pct/100 도면비율)을 0~100 % 텍스트로 표시. 옆에 작은 회색으로 plan 비율 병기 옵션.
- 너무 넓어지므로 마일스톤 컬럼은 **헤더 토글로 접기/펼치기**(기본 접힘). 접힌 상태에서는 기존 Plan/Actual/% 3컬럼만.

### Stage Plan/Actual 도면 수 표시
- 마일스톤 접힘 상태에서도 Plan/Actual 컬럼이 **"건수 (백분율)"** 로 표시.
  - 예: `12 (75%)` / Actual `9 (56%)`.

### FAFP 행 시각 표시
- FAFP 행에 작은 뱃지 `FAFP WF` (툴팁: "SD 0% / DD 50% / CD 50%로 가중").

## 파일 영향 요약

- `src/lib/mdr/weights.ts` — FAFP 전용 WF 상수 추가
- `src/lib/mdr/summaryEngine.ts` — `StageCell`/`DiscCell` 확장, 마일스톤 카운트 산정, FAFP discProgress 분기
- `src/components/mdr/MdrSummaryPanel.tsx` — 마일스톤 컬럼 헤더/셀, 토글, FAFP 뱃지

## 검증 시나리오

1. SMP&CCM/ARCH: 25장 도면, SD50/SD100 비율이 엑셀(1.0)과 ±소수 일치
2. General/ARCH(플랜트 제외): 행은 표시되되 합산 제외 뱃지 + 마일스톤 카운트도 표시
3. FAFP 분야: discProgress가 Stage WF(0.2/0.4/0.4) 대신 (0/0.5/0.5)로 산정되는지 단위 비교

## 비포함 (다음 단계로 보류)

- C. As-of date 선택기 (다음 plan)
- E. Total 행, F. Remark 컬럼, G. 블록별 마일스톤 차등, I. MH&DWG 시트
- WF 1.1(Aux 분리) / 1.2(소방 10% 별도) / 3.1 토글 — DB 구조 변경 필요해 별도 plan
