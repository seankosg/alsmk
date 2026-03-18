

## 현황 분석

현재 대시보드에는 "계획 대비 실적 미달" 항목을 팀별로 직관적으로 보여주고 드릴다운하는 기능이 부족합니다:

- **TeamProgressChart**: 팀별 Planned vs Actual 막대 차트만 있고, 클릭해서 세부 항목을 볼 수 없음
- **TeamHeatmap**: issue_flag 기반 색상만 표시, 계획 대비 Gap 정보 없음, 클릭 드릴다운 없음
- **CriticalIssueBoard**: issue_flag가 설정된 항목만 표시 — 자동으로 미달 감지하지 않음

## 개선 제안

### 1. TeamHeatmap 개선 — "Gap 기반 히트맵 + 드릴다운"

현재 issue_flag 기반 색상 → **계획 대비 실적 Gap(%)을 기준으로 색상 계산**으로 변경

- 팀 > 파트별 칩에 평균 Gap% 수치 표시
- 색상: Gap ≥ 0 초록, -10~0 노랑, < -10 빨강 (자동 계산)
- **파트 칩 클릭 시** 해당 파트의 미달 태스크 목록을 Dialog로 표시
- Dialog 내에서 각 태스크 클릭 → 기존 TaskDetailDialog 연결

### 2. TeamProgressChart 개선 — "바 클릭 드릴다운"

- 팀 바를 클릭하면 해당 팀의 **미달 태스크 목록 Dialog** 표시
- Gap이 마이너스인 항목만 필터, Gap 큰 순서로 정렬
- 각 항목 클릭 → TaskDetailDialog로 연결

### 3. 새 컴포넌트: "Behind Schedule" 카드 (CriticalIssueBoard 옆 또는 대체)

현재 CriticalIssueBoard는 수동 issue_flag 기반 → **자동 감지 카드 추가**:
- `current_progress < calcPlannedProgress()` 인 태스크를 자동 추출
- 팀별로 그룹핑하여 표시 (팀 코드 헤더 + 미달 태스크 리스트)
- Gap% 내림차순 정렬, 클릭 시 TaskDetailDialog

## 구현 계획

### 파일 변경

1. **`src/components/dashboard/TeamHeatmap.tsx`** — 대폭 개선
   - `calcPlannedProgress` import하여 파트별 평균 Gap 계산
   - 색상을 Gap 기반으로 변경
   - 칩에 Gap% 수치 표시
   - 칩 클릭 시 state로 선택된 파트 저장
   - 선택된 파트의 미달 태스크 목록을 Dialog로 표시
   - 태스크 클릭 → TaskDetailDialog 연결 (members, teams, milestones 쿼리 추가)

2. **`src/components/dashboard/TeamProgressChart.tsx`** — 클릭 드릴다운 추가
   - 바 차트 `onClick` 이벤트 핸들러 추가
   - 클릭된 팀의 미달 태스크 목록 Dialog 표시
   - TaskDetailDialog 연결

3. **`src/components/dashboard/BehindScheduleBoard.tsx`** — 신규
   - `current_progress < planned` 인 태스크 자동 추출
   - 팀별 그룹핑 (Accordion 또는 섹션)
   - 각 태스크에 Gap%, task_code, title, assignee 표시
   - 클릭 → TaskDetailDialog

4. **`src/pages/Index.tsx`** — 레이아웃 조정
   - BehindScheduleBoard를 CriticalIssueBoard와 같은 행 또는 대체 배치

### UI 흐름

```text
Dashboard
├── TeamHeatmap (파트 칩 클릭)
│   └── Dialog: 파트 미달 태스크 목록
│       └── TaskDetailDialog (개별 태스크)
├── TeamProgressChart (바 클릭)
│   └── Dialog: 팀 미달 태스크 목록
│       └── TaskDetailDialog
└── BehindScheduleBoard (자동 감지)
    └── 팀별 그룹 > 태스크 클릭
        └── TaskDetailDialog
```

DB 변경이나 마이그레이션은 필요하지 않습니다. 모든 데이터는 기존 tasks 테이블의 `current_progress`, `start_date`, `end_date`로 계산합니다.

