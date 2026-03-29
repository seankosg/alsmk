

# 알림 클릭 시 해당 Task로 이동 기능 추가

## 현재 상태

- 알림 클릭 → `markAsRead()` 호출 (읽음 처리만)
- 알림에 `task_id` 필드가 있지만 활용되지 않음

## 구현 방법

알림 클릭 시 `/workspace` 페이지로 이동하면서 해당 Task의 상세 다이얼로그를 자동으로 열도록 합니다.

### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/layout/NotificationBell.tsx` | 클릭 시 `markAsRead` + `navigate(/workspace?task={task_id})` + popover 닫기 |
| `src/pages/Workspace.tsx` | URL에 `task` 쿼리 파라미터가 있으면 해당 TaskDetailDialog 자동 오픈 |

### NotificationBell 변경

- `useNavigate` 추가
- 알림 클릭 핸들러에서 `task_id`가 있으면 `/workspace?task={n.task_id}`로 navigate
- popover를 닫음 (`setOpen(false)`)

### Workspace 변경

- `useSearchParams`로 `task` 파라미터 감지
- 파라미터가 있으면 해당 task를 조회 후 TaskDetailDialog를 자동 오픈
- 다이얼로그 닫을 때 URL에서 `task` 파라미터 제거

