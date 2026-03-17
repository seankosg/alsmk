

## Plan: Email-Based Authentication with Admin System

### Summary
첫 번째 가입자가 자동으로 Admin이 되고, Admin이 다른 멤버에게도 Admin 역할을 부여할 수 있는 인증 시스템을 구현합니다. Admin은 모든 멤버의 Workspace를 조회/수정/삭제할 수 있으며, 모든 변경사항이 activity_log에 기록됩니다.

### Architecture

```text
Edge Function: admin-manage-user
  ├─ create: auth.admin.createUser → members.user_id 연결
  │          첫 번째 사용자면 → user_roles에 admin 자동 삽입
  ├─ reset-password: auth.admin.updateUserById
  └─ toggle-admin: user_roles에 admin 추가/제거

Login → /login (AppLayout 외부)
  └─ signInWithPassword → 세션 생성
  └─ Admin이면 → 전체 멤버 Workspace 접근
  └─ 일반 멤버면 → 본인 Workspace만 접근

AppLayout Auth Guard
  └─ 미로그인 → /login 리다이렉트
  └─ Admin 여부에 따라 메뉴/기능 분기
```

### Database Changes

1. **members 테이블에 `email` 컬럼 추가** (nullable, unique)
2. **user_roles 테이블**은 이미 존재 (`has_role` 함수도 존재)

### Edge Function: `admin-manage-user`

- `verify_jwt = false`, 코드 내 JWT 검증
- **create**: `auth.admin.createUser({ email, password, email_confirm: true })` → `members.user_id`/`email` 업데이트 → user_roles 테이블에 사용자 수 체크, 첫 번째면 admin 역할 자동 부여
- **reset-password**: `auth.admin.updateUserById(userId, { password })`
- **toggle-admin**: `user_roles`에 admin 역할 삽입 또는 삭제 (Admin만 호출 가능)
- 첫 번째 계정 생성 시에는 JWT 검증 스킵 (아직 admin이 없으므로)

### New Pages

| Page | Description |
|------|-------------|
| `/login` | 이메일+비밀번호 로그인 폼, AppLayout 외부 |
| `/change-password` | 로그인 사용자가 본인 비밀번호 변경 |

### Component Changes

**AdminMembers.tsx**
- 이메일 필드 추가, 계정 생성/비밀번호 재설정 다이얼로그
- Admin 역할 토글 버튼 (Admin만 보임)
- 계정 상태 배지 (연결됨/미연결/Admin)

**AppLayout.tsx**
- `supabase.auth.onAuthStateChange` 기반 Auth Guard
- 미로그인 시 `/login` 리다이렉트

**AppSidebar.tsx**
- 하단에 현재 사용자 표시 + 로그아웃 버튼
- 비밀번호 변경 링크

**Workspace.tsx (TaskTable)**
- Admin 로그인 시: 전체 멤버의 태스크 표시, 멤버별 필터 제공
- 일반 멤버: 본인 assignee_id 태스크만 표시
- Admin의 수정/삭제 시 activity_log에 자동 기록

**App.tsx**
- `/login`, `/change-password` 라우트 추가
- 로그인 페이지는 AppLayout 외부 배치
- Admin 전용 라우트(`/admin`) 접근 제한

### Activity Logging
- Admin이 태스크 수정/삭제/조정 시 `activity_log` 테이블에 기록
- 기록 항목: user_name, action, entity_type, entity_id, details (변경 전/후)

### Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/migrations/...` | members에 email 컬럼 추가 |
| `supabase/config.toml` | admin-manage-user verify_jwt 설정 |
| `supabase/functions/admin-manage-user/index.ts` | Edge function 생성 |
| `src/pages/Login.tsx` | 로그인 페이지 생성 |
| `src/pages/ChangePassword.tsx` | 비밀번호 변경 페이지 생성 |
| `src/hooks/useAuth.ts` | Auth 상태 + Admin 여부 커스텀 훅 |
| `src/components/admin/AdminMembers.tsx` | 계정/역할 관리 UI 확장 |
| `src/components/layout/AppLayout.tsx` | Auth guard 추가 |
| `src/components/layout/AppSidebar.tsx` | 로그아웃/사용자 정보 추가 |
| `src/components/tasks/TaskTable.tsx` | Admin 전체 조회 + 로그 기록 |
| `src/App.tsx` | 라우팅 업데이트 |
| `mem://index.md` | Auth 메모 업데이트 |

### Security
- Edge function에서 `has_role()` 검증 (첫 계정 생성 시 예외)
- Admin 라우트 클라이언트 + 서버 양쪽 검증
- 비밀번호 최소 6자

