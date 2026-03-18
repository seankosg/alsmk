

## 변경 사항

### 1. BehindScheduleBoard 개선
- Collapsible `defaultOpen` → `defaultOpen={false}` (접힌 상태가 기본)
- UpcomingDeadlines와 동일한 고정 높이 적용: `max-h-[260px] overflow-y-auto scrollbar-thin`

### 2. CriticalIssueBoard 개선
- 동일하게 `max-h-[260px] overflow-y-auto` 적용하여 카드 크기 통일

### 3. 신규: PartStatusBoard 컴포넌트
파트별로 Behind Schedule / Upcoming Deadline / Critical Issue 현황을 한 카드에 요약하는 위젯.

**구성:**
- tasks, teams, parts, members 쿼리 사용
- 팀 > 파트 구조로 Collapsible 그룹핑
- 각 파트별로 3개 수치 칩 표시:
  - Behind Schedule 수 (빨강)
  - Upcoming D-7 수 (노랑)
  - Critical/Warning Issue 수 (주황)
- 파트 행 클릭 시 해당 파트의 태스크 목록 Dialog → TaskDetailDialog 드릴다운
- 카드 높이 고정 `max-h-[400px] overflow-y-auto`

### 4. Index.tsx 레이아웃
- TeamHeatmap 아래에 PartStatusBoard 배치 (full-width)

### 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/components/dashboard/BehindScheduleBoard.tsx` | `defaultOpen={false}`, `max-h-[260px]` 추가 |
| `src/components/dashboard/CriticalIssueBoard.tsx` | `max-h-[260px]` 추가 |
| `src/components/dashboard/PartStatusBoard.tsx` | 신규 생성 |
| `src/pages/Index.tsx` | PartStatusBoard import 및 배치 |

