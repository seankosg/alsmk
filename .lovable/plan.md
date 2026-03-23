

## Task → CPM Activity 매핑 다이얼로그 (역방향)

### 개요
CPM Scheduler의 `MapTasksDialog`는 Activity → Task 방향 매핑. 이번에는 반대로 Workspace의 TaskDetailDialog에서 Task → Activity 방향 매핑 UI를 추가.

### 구현

**1. 새 컴포넌트: `src/components/cpm/MapActivitiesDialog.tsx`**
- `MapTasksDialog`와 동일한 패턴 (역방향)
- Props: `taskId`, `taskTitle`, `onMapped`
- `cpm_activities` 테이블에서 전체 Activity 목록 조회
- `cpm_task_mappings`에서 현재 task_id로 기존 매핑 조회
- 검색: Activity name, wbs_full, mpp_task_id로 필터
- 체크박스 다중선택 → 저장 시 기존 매핑 삭제 후 재삽입
- 각 Activity 항목에 CP 배지, duration, progress 표시
- ScrollArea + 세로 스크롤바 (MapTasksDialog와 동일 스타일)

**2. `TaskDetailDialog.tsx` 수정**
- `MapActivitiesDialog` import 및 DialogHeader 영역 또는 하단에 "CPM 매핑" 버튼 추가
- task.id와 task.title을 props로 전달

### 변경 파일
| 파일 | 변경 |
|------|------|
| `src/components/cpm/MapActivitiesDialog.tsx` | 신규 생성 |
| `src/components/tasks/TaskDetailDialog.tsx` | 매핑 버튼 추가 |

