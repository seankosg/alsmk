

# 계획 완료일 초과 시 자동 알림 (Edge Function + pg_cron)

## 개요
매일 자동으로 실행되는 Edge Function이 기한 초과 태스크를 감지하여:
1. **notifications** 테이블에 알림 삽입 (담당자 + PM) → NotificationBell에서 실시간 수신
2. **Messages** 시스템으로 DM 자동 발송 (conversations/direct_messages 활용)

중복 알림 방지를 위해 `task_id + type + date` 조합으로 당일 이미 발송된 알림은 스킵합니다.

## 변경 사항

### 1. Edge Function: `supabase/functions/check-overdue-tasks/index.ts`

Service role로 실행되며:
1. `tasks` 테이블에서 `end_date < today AND current_progress < 100 AND deleted_at IS NULL` 조건의 태스크 조회
2. 각 태스크의 `assignee_id`와 해당 팀의 PM(`members.is_pm = true`) 목록 수집
3. 당일 이미 동일 task_id + type('overdue_alert')로 알림이 있는지 확인 → 중복 스킵
4. `notifications` 테이블에 배치 삽입 (제목: "⚠ 기한 초과: {task_code}", 메시지: "{title} - {지연일수}일 초과")
5. 시스템 메시지 DM 발송: 자동 생성된 시스템 conversation을 통해 담당자/PM에게 직접 메시지 전송

```text
Edge Function 로직:
  overdue tasks (end_date < today, progress < 100)
    → for each task:
       recipients = [assignee] + [PMs of task's team]
       → skip if notification already sent today
       → insert notifications
       → send DM via conversations/direct_messages
```

### 2. pg_cron 스케줄 등록 (insert tool 사용)

매일 오전 9시(KST, UTC 00:00)에 Edge Function을 HTTP POST로 호출하는 cron job 등록.

### 3. 시스템 발신자 처리

DM 발송 시 `sender_id`는 "시스템" 역할이 필요합니다. `members` 테이블에서 name이 'System'인 멤버를 조회하거나, 없으면 첫 번째 PM을 sender로 사용합니다.

→ 실제로는 **notifications만 사용**하는 것이 더 깔끔합니다. DM까지 보내면 메시지 목록이 자동 메시지로 오염될 수 있습니다.

## 질문

DM 자동 발송까지 필요한지, 아니면 notifications(벨 알림 + 실시간 토스트)만으로 충분한지 확인이 필요합니다.

### 변경 파일

| 파일 | 내용 |
|------|------|
| `supabase/functions/check-overdue-tasks/index.ts` | 기한 초과 감지 + 알림/DM 발송 Edge Function |
| DB (insert tool) | pg_cron + pg_net 확장 활성화, cron job 등록 |

