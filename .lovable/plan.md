

# 전체 백업/복원 시스템 구현 (Phase 1~3)

## Phase 1: 수동 백업/복원

### DB 마이그레이션
- `data_backups` 테이블 생성 (id uuid, name text, data jsonb, created_at timestamptz)
- RLS: authenticated SELECT, admin INSERT/DELETE

### Edge Function: `backup-export`
- Service role로 모든 주요 테이블 데이터를 JSON으로 조회하여 반환
- 대상: tasks, teams, parts, members, milestones, calendar_events, cpm_activities, cpm_snapshots, cpm_task_mappings, conversations, conversation_members, direct_messages, personnel_targets, project_settings, notifications, activity_log, issue_threads, task_comments
- Admin 권한 확인
- `save_to_db` 파라미터가 true면 `data_backups` 테이블에도 저장

### Edge Function: `backup-import`
- JSON 업로드 → 테이블별 upsert 처리
- Admin 권한 확인
- 각 테이블 순서대로 처리 (참조 관계 고려)

## Phase 2: 주요 엔티티 Soft Delete 확장

### DB 마이그레이션
- `teams`, `parts`, `members`, `milestones`, `calendar_events` 테이블에 `deleted_at` (timestamptz nullable), `deleted_by` (uuid nullable) 컬럼 추가

### 코드 수정
- AdminTeams, AdminParts, AdminMembers, AdminMilestones: 삭제 시 soft delete (deleted_at 설정)
- 각 쿼리에 `.is("deleted_at", null)` 필터 추가
- Calendar 이벤트 쿼리에도 동일 적용

## Phase 3: 자동 백업 스케줄

### DB (insert tool — pg_cron + pg_net 활성화)
- `pg_cron`, `pg_net` 확장 활성화 (마이그레이션)
- cron job 등록 (insert tool): 매일 자정 backup-export 호출하여 data_backups에 저장
- 보관 기간 초과 백업 삭제 cron job

### AdminSettings UI 확장
기존 Project Settings 카드 아래에 3개 카드 추가:

**카드 1: 수동 백업/복원**
- "백업 다운로드" 버튼 → backup-export 호출 → JSON 파일 다운로드
- "백업 복원" 파일 업로드 → 확인 다이얼로그 → backup-import 호출
- 최근 백업 시간 표시

**카드 2: 자동 백업 설정**
- 자동 백업 ON/OFF 토글 (project_settings 저장)
- 주기: 매일/매주/매월 선택
- 보관 기간: 7일/14일/30일

**카드 3: 백업 히스토리**
- data_backups 목록 (날짜, 이름)
- 각 항목: 다운로드/삭제 버튼

## 변경 파일

| 파일 | 내용 |
|------|------|
| DB 마이그레이션 1 | `data_backups` 테이블 생성 |
| DB 마이그레이션 2 | 주요 테이블에 `deleted_at`, `deleted_by` 추가 |
| DB 마이그레이션 3 | `pg_cron`, `pg_net` 확장 활성화 |
| `supabase/functions/backup-export/index.ts` | 전체 데이터 JSON 내보내기 |
| `supabase/functions/backup-import/index.ts` | JSON 복원 |
| `supabase/config.toml` | 새 Edge Function 설정 추가 |
| `src/components/admin/AdminSettings.tsx` | 백업/복원 UI + 자동 스케줄 + 히스토리 |
| `src/components/admin/AdminTeams.tsx` | Soft delete 적용 |
| `src/components/admin/AdminParts.tsx` | Soft delete 적용 |
| `src/components/admin/AdminMembers.tsx` | Soft delete 적용 |
| `src/components/admin/AdminMilestones.tsx` | Soft delete 적용 |
| `src/pages/Calendar.tsx` | deleted_at 필터 추가 |
| insert SQL | pg_cron 자동 백업 스케줄 등록 |

