## 목표
마일스톤 모니터링 테이블의 P/A/Δ 컬럼에 드래그 핸들을 추가하고, 사용자가 조절한 너비를 localStorage에 저장하여 다음 접속 시 그대로 복원.

## 구현 내용

### 1) 너비 상태 관리 (`MdrMilestoneMonitorPanel.tsx`)
- 새 state: `columnWidths: Record<string, number>` — 키별 px 너비 저장
- localStorage 키: `mdr.monitor.columnWidths`
- 초기값: 저장된 값 로드 → 없으면 기본 56px
- 변경 시 localStorage 즉시 저장 (`useEffect`)

### 2) 컬럼 키 체계
각 P/A/Δ 셀에 안정적 키 부여:
- Overall Progress: `op-{stage}-{P|A|D}` (예: `op-SD-P`)
- 마일스톤별: `ms-{stage}-{pct}-{planDate}-{P|A|D}`

### 3) 드래그 핸들 컴포넌트
3단 헤더 `<th>` 우측에 `<div>` 핸들 추가:
- 절대 위치, 우측 끝 4px 너비, `cursor-col-resize`
- `onMouseDown` → `mousemove` 리스너로 delta 계산 → 너비 업데이트
- `mouseup` 시 리스너 해제 및 저장
- 더블클릭 → 해당 키 삭제 (기본 56px 복원)
- 최소 32px, 최대 200px 제한

### 4) 너비 적용
- 기존 `w-14` (Tailwind 클래스) 제거
- 3단 헤더 + 본문 데이터 셀(있음/없음 모두) `<th>`, `<td>` 에 `style={{ width: getWidth(key), minWidth: getWidth(key) }}` 적용
- 헤더 `<th>` 는 `relative` 클래스로 핸들 absolute 기준점 확보

### 5) 동작 영향 범위
- 1단/2단 헤더는 `colSpan` 기반이라 자동으로 너비 합산됨 — 별도 수정 불필요
- 본문 셀 6군데(있음/없음 × Overall/마일스톤) 모두 동일한 키로 너비 참조

## 변경 파일
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` 만 수정

## 사용자 경험
- 핸들 위에 마우스 → 좌우 화살표 커서
- 드래그 → 실시간 너비 변경
- 떼면 자동 저장 (toast 없음, 조용히 저장)
- 더블클릭 → 해당 컬럼 기본 너비(56px) 복원
- 새로고침/재접속 시에도 너비 유지
