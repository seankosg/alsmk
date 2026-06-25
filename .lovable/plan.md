## 마일스톤 모니터링 테이블 개선 계획

### 1. Overall Progress 컬럼 추가
Total DWG 우측에 신규 컬럼 그룹 삽입:
- **1단**: `Overall Progress` (colSpan=9, 회색 계열 강조 배경)
- **2단**: `SD` / `DD` / `CD` (각 colSpan=3, 단계별 파스텔 배경 — 기존 STAGE_THEME 재사용)
- **3단**: `P` / `A` / `Δ`

**값 산출 규칙** (사용자 확정):
> 기준일(asOf) 기준으로 각 단계의 **마지막(최대 pct) 마일스톤**의 P/A/Δ 값을 그대로 표시.

구현:
- `MdrMilestoneMonitorPanel.tsx` 내부에서 기존 `headers` (이미 stage별 milestone 정렬됨) 의 마지막 항목 키로 `row.cells.get(mkKey(stage, lastMs.pct, lastMs.planDate))` 조회 → cell 없거나 마일스톤 없으면 `—`.
- 별도 엔진/DB 변경 없음 (이미 매트릭스에 모든 값 존재).

### 2. SD / DD / CD 단계별 접기/펼치기
- `useState<Record<MdrStage, boolean>>` 로 단계별 collapsed 상태 관리, **기본값: 모두 접힘**.
- 1단 stage 헤더 셀(SD/DD/CD)을 클릭 가능하게 만들고 `ChevronRight`/`ChevronDown` 아이콘 표시.
- **접힘 상태**:
  - 1단: stage 헤더는 그대로(colSpan=1, 좁게 표시 `▶ SD`)
  - 2단/3단: 해당 stage의 마일스톤 컬럼 전부 숨김 → 단일 placeholder 셀(`…`) 또는 완전 생략
  - 본문: 해당 stage 셀들 미렌더
- **펼침 상태**: 현재와 동일하게 마일스톤별 P/A/Δ 표시.
- Overall Progress 컬럼은 접기 영향 없음(항상 표시) — 접힘 상태에서도 단계별 요약을 볼 수 있게 함.

### 3. 영향 파일
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` (단일 파일 수정, presentation only)

### 4. 검증
- `/design/summary` 진입 → 기본 SD/DD/CD 모두 접힘 + Overall Progress 컬럼만 P/A/Δ 표시 확인
- 각 stage 헤더 클릭 시 해당 단계 마일스톤 컬럼 펼침/접힘 토글 정상 동작
- Overall Progress 값이 각 stage 마지막 마일스톤 P/A/Δ와 일치하는지 한 행 샘플 확인
