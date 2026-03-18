

## Issue Flag 알림 시스템 구현 계획

### 핵심 요구사항
1. **Flag 변경 권한 제한**: Assignee 본인 + PM + Admin만 issue_flag 변경 가능
2. **알림 수신자 선택**: Flag를 warning/critical로 변경 시, 조직 멤버 목록에서 단일/다중 선택하여 알림 발송
3. **인앱 알림**: 선택된 수신자에게 알림 전달 + 헤더 벨 아이콘으로 확인

### DB 변경

**`notifications` 테이블 생성:**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| recipient_id | uuid NOT NULL | members.id (수신자) |
| sender_id | uuid | members.id (발송자) |
| task_id | uuid NOT NULL | tasks.id |
| type | text | 'flag_raised', 'flag_resolved' |
| title | text | 알림 제목 |
| message | text | 알림 내용 |
| is_read | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |

RLS: 로그인 사용자가 자신의 `recipient_id`에 해당하는 알림만 SELECT/UPDATE 가능. INSERT는 authenticated 사용자 모두 가능.

Realtime 활성화: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`

### 파일 변경

| 파일 | 변경 |
|------|------|
| **DB Migration** | `notifications` 테이블 + RLS + Realtime |
| **`src/components/tasks/TaskDetailDialog.tsx`** | (1) Issue Flag 섹션에 권한 체크 — `canEditFlag` = assignee 본인 or PM or Admin일 때만 flag Select 활성화. (2) Flag를 normal→warning/critical로 변경 시 멤버 선택 UI 표시 (Popover + Checkbox 리스트). (3) Save 시 선택된 멤버들에게 notifications insert |
| **`src/components/layout/NotificationBell.tsx`** (신규) | 벨 아이콘 + 읽지 않은 알림 수 배지 + 드롭다운 목록. Realtime 구독으로 실시간 갱신. 알림 클릭 시 읽음 처리 |
| **`src/components/layout/AppLayout.tsx`** | 헤더의 Bell 버튼을 NotificationBell 컴포넌트로 교체 |

### TaskDetailDialog 상세 동작

**권한 체크:**
```text
canEditFlag = (auth.memberId === task.assignee_id) || auth.isAdminOrPm
```
- `canEditFlag`가 false면 Issue Flag Select를 `disabled`로 표시

**알림 수신자 선택 UI:**
- Flag가 `normal` → `warning`/`critical`로 변경될 때, Issue 입력 영역 아래에 "Notify Members" 섹션 표시
- 전체 멤버 목록을 Checkbox로 나열 (이름 + 팀명)
- 기본 선택: 해당 태스크의 assignee (본인이 아닌 경우)
- "Select All" / "Deselect All" 버튼

**Save 시:**
- 기존 task update + 선택된 멤버 수만큼 `notifications` 테이블에 batch insert
- 알림 title: `"[{flag}] {task_code}"`, message: `"{sender_name}이(가) 이슈를 보고했습니다: {issue_description}"`

### NotificationBell 상세

- `members` 테이블의 `user_id`로 현재 로그인 사용자의 `member.id` 조회 (AuthContext의 `memberId` 활용)
- `notifications` 테이블에서 `recipient_id = memberId` 조건으로 최근 20개 fetch
- Realtime 구독으로 새 알림 도착 시 toast + 배지 갱신
- 알림 클릭 → `is_read = true` 업데이트 + 해당 task 정보 표시
- "모두 읽음" 버튼

