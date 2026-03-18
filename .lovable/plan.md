

## My Dashboard 재구성 계획

### 현재 상태
KPI 카드 4개: Total Tasks, Completion Rate, Behind Schedule, Avg Gap
하단: Behind Schedule 목록, Upcoming Deadlines, Task Progress Donut

### 변경 후 KPI 카드 구성 (상단 3행)

**1행 — 태스크 수량 카드 (6열)**

| 카드 | 계산 로직 |
|------|----------|
| Total Tasks | `myTasks.length` |
| Planned In-Progress | 계획상 시작~종료 사이에 있고 미완료인 태스크 (`start_date <= today <= end_date && !actual_finish`) |
| Actual In-Progress | 실제 진행 중인 태스크 (`0 < current_progress < 100 && !actual_finish`) |
| Ahead of Schedule | `gap > 0` (actual > planned) |
| On Track | `gap === 0` (actual === planned) |
| Behind Schedule | `gap < 0` (actual < planned), 클릭 시 아래 목록으로 스크롤 |

**2행 — 진도율 카드 (3열)**

| 카드 | 계산 |
|------|------|
| Avg Planned % | `평균(calcPlannedProgress)` |
| Avg Actual % | `평균(current_progress)` |
| Gap (차이) | `Avg Actual - Avg Planned`, 색상: 양수=green, 음수=red |

**3행 — Behind Schedule 목록 (전체 폭)**
- 기존과 동일한 behind task 목록 유지
- 각 항목 클릭 시 → `TaskDetailDialog` 열기 (기존 동작 유지, My Workspace 태스크와 연동)
- task_code, title, gap%, progress bar 표시

### 하단 유지
- Upcoming Deadlines, Task Progress Donut는 그대로 유지

### 파일 변경

| 파일 | 변경 |
|------|------|
| `src/pages/MyDashboard.tsx` | KPI 카드 섹션을 위 구조로 재구성. 기존 Behind Schedule 카드/Upcoming/Donut은 유지 |

DB 변경 없음.

