## 문제

마일스톤 모니터링 패널 Overall Progress(WF 적용)에서 일부 STR 행의 **SD 계획이 50%** 로 표시됨.

- 영향 행: `CRM/STR`, `HSM/STR`, `SMP&CCM/STR`
- 원인: 해당 STR 도면들의 SD `pct=100` 마일스톤 `plan_date = 2026-07-17` (기준일 2026-06-25보다 미래).
- `milestoneMonitorEngine.buildMatrix` 의 `stageW` SD 계획 산식이 **"plan_date ≤ asOf 의 최대 pct"** 를 쓰기 때문에 미도래 100% 마일스톤을 제외하고 50% 만 누적 → 50% 표시.

반면 Raw Data / Summary 패널은 `drawingMilestonePlannedPct` 를 사용 → **SD 는 항상 100%** 로 처리. 두 화면이 다른 산식을 쓰는 불일치.

## 해결

`src/lib/mdr/milestoneMonitorEngine.ts` `buildMatrix` 의 `stageW` 계산을 Raw/Summary 와 동일하게 맞춤.

1. **SD 단계 계획**: `planPct = 100` 으로 고정 (in-scope 인 모든 도면).
2. DD/CD 단계 계획·실적, SD 실적은 기존 산식 유지.
3. per-milestone 셀(plan/actual) 산식은 이미 `drawingMilestonePlannedPct`(SD=100) 사용 중이므로 변경 없음.

수정 후 사용자에게 패널의 **[신규 계산]** 버튼을 눌러 스냅샷을 갱신하도록 안내. (이미 저장된 snapshot 행의 `stage_plan_pct=50` 은 재계산 시 100 으로 덮어써짐.)

## 변경 파일

- `src/lib/mdr/milestoneMonitorEngine.ts` — `buildMatrix` 내 SD stageW 계획 분기 1줄 추가.
