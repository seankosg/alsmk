## 목표
Stage 셀의 **Plan / Actual**을 단순 개수가 아니라 **조회일(또는 Data Date) 기준 가중 평균 진도율(%)**로 재정의합니다. EV(Earned Value) 방식.

## 데이터 모델 활용
- `mdr_milestones(drawing_id, stage, pct, plan_date)` — 도면·스테이지별 다중 체크포인트(예: SD 50% by 5/8, SD 100% by 5/8). 누적 계획 곡선.
- `mdr_progress(drawing_id, stage, pct, is_done, actual_date)` — 동일 구조의 실적 체크포인트.

## 계산 정의

### 도면 단위 — 조회일 D 기준
- **계획 진도율** `P(drawing, stage, D)` = max(milestone.pct where plan_date ≤ D), 없으면 0.
- **실적 진도율** `A(drawing, stage, D)` = max(progress.pct where is_done=true AND (actual_date IS NULL OR actual_date ≤ D)), 없으면 0.
- 둘 다 0~100 정수.

### 셀 단위 (Block × Discipline × Stage)
- **Plan %** = 해당 셀에 속한 도면들의 P 평균
- **Actual %** = 해당 셀에 속한 도면들의 A 평균
- **DWG** = 도면 수(현행 유지) — "이 셀이 몇 장 도면을 다루는가" 컨텍스트
- 분모는 "해당 stage에 마일스톤이 하나라도 있는 도면 수" (계획이 없는 도면은 제외해 왜곡 방지)

### 롤업
- **Disc Progress** = 기존 가중 평균 유지 (SD/DD/CD WF × 셀 Actual%)
- **Block Progress / Overall** = 기존 그대로 (Actual% 기반)
- (다음 단계 질문에서 % 컬럼 의미 확정 시 추가 조정)

## UI 변경 (`MdrSummaryPanel.tsx`)
- Stage 헤더: `Plan / Actual / %` 3열 유지 (원 디자인 유지)
- Plan 셀 표시: `45.8%` 같은 평균 % (현재 정수 도면 수에서 변경)
- Actual 셀 표시: `12.3%` 같은 평균 %
- % 컬럼: 다음 단계에서 정의 (현재는 평균 진척률 그대로 두고 후속 작업에서 확정)
- 0% 이거나 계획 없음(분모 0)이면 `-`
- 헤더 툴팁: "조회일 기준 계획/실적 진도율 (가중 평균)"

## 데이터 레이어 (`src/lib/mdr/summaryEngine.ts`)
- `RawDrawing` 타입에 mdr_milestones·mdr_progress 행 그대로 사용 (이미 select 중)
- `StageCell` 인터페이스 의미 재정의:
  - `plan: number` → 0~1 (평균 계획 진도율)
  - `actual: number` → 0~1 (평균 실적 진도율)
  - `progress: number` → 0~1 (현행 평균 진척률, %컬럼용 — 후속 단계에서 재정의)
  - `drawingCount: number` 추가 (해당 stage 마일스톤 보유 도면 수)
- 계산 함수:
  - `planAtDate(milestones, stage, today): number` — 0~100 정수
  - `actualAtDate(progress, stage, today): number` — 0~100 정수
- 도면 단위 계산 → 셀별 평균
- "Data Date" 입력은 현재는 `today = new Date()` 고정 (Phase 2에서 사용자 선택 UI 추가 가능)

## 보조 셀렉터 영향
- `selectStageRollup`(Dashboard용): plan/actual 합 → 평균(%)로 자연 변경, `rate = actual/plan` 의미 유지
- `useMdrOverdueDrawings`: 변경 없음 (plan_date < today & pct<100 기준 동일)

## 마이그레이션 영향
- DB 스키마 변경 없음. 순수 클라이언트 계산 로직 변경.

## 범위 외 / 다음 단계
- **% 컬럼 의미 확정** — 사용자 후속 답변 후 별도 plan
- Data Date 사용자 선택 UI
- 주간 누계 곡선(S-curve)
