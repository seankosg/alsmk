## 변경 사항

### 1. 미도래 마일스톤 A=Null 처리 (마일스톤 셀만)
**파일**: `src/lib/mdr/milestoneMonitorEngine.ts`
- `buildMatrix()` 의 마일스톤별 셀 계산부에서, 해당 마일스톤의 `plan_date > asOf` 인 도면들은 A 합산 대상에서 제외하는 대신, **셀 단위 A** 자체를 `null` 로 표시한다.
- 판정 기준: 마일스톤(stage+code)의 도면별 plan_date 가 **모두** asOf 보다 미래이면 `actual = null`, `delta = null`. (도면 중 일부만 도래/미도래인 경우는 도래분만 평균 → 기존 로직 유지)
- `MonitorCell` 타입에 `actual: number | null`, `delta: number | null` 허용.
- WF/비WF 양쪽 모두 동일 규칙 적용.
- Overall Progress 컬럼은 영향 없음 (요청 범위 외).

### 2. 역진행/정체 경고 (핑크 배경)
**파일**: `src/lib/mdr/milestoneMonitorEngine.ts`, `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- 행별로 stage(SD/DD/CD) 내 마일스톤을 코드/순서대로 정렬해 **이전 마일스톤 A** 와 비교.
- 조건: `prevA !== null && prevA > 0 && currA !== null && currA <= prevA` → `warn: true` 플래그.
- 첫 마일스톤, prevA가 null/0인 경우, currA가 null인 경우는 경고 없음.
- `MonitorCell` 에 `warn?: boolean` 추가.
- 패널 렌더링에서 `warn` 인 셀에 핑크 배경 클래스 적용 (예: `bg-pink-500/20 dark:bg-pink-500/25`). A 셀과 Δ 셀 모두 적용.

### 3. UI 표시
- Null A/Δ 값은 `—` 로 표시 (기존 미입력 표시와 동일 톤).
- 푸터 안내에 "기준일 미도래 마일스톤의 A는 표시하지 않음", "이전 마일스톤 대비 A가 같거나 감소하면 핑크 경고" 항목 추가.

### 검증
- `/design/summary` 모니터 패널에서 미래 plan_date 마일스톤 컬럼 A=`—` 확인.
- 동일 stage 내 이전 ms A=50, 현재 ms A=40 인 행에서 핑크 하이라이트 확인.
- WF 토글 ON/OFF 모두 동일 동작 확인.
