

# Guest 권한 등급 추가 (Guest / Super Guest)

## 개요
기존 Admin / PM / 일반 사용자 외에 **Guest**(대시보드만 읽기전용)와 **Super Guest**(모든 메뉴 읽기전용) 두 가지 게스트 등급을 추가합니다. 게스트는 Organization에 포함되지 않으며 팀/부서가 없습니다.

## 변경 사항

### 1. DB 마이그레이션
- `app_role` enum에 `'guest'`, `'super_guest'` 값 추가
- `has_role` 함수는 그대로 사용 가능 (새 enum 값 자동 지원)

### 2. `src/hooks/useAuth.ts`
- `isGuest`, `isSuperGuest` 상태 추가
- `fetchRoles`에서 `guest` / `super_guest` role 조회 추가

### 3. `src/components/layout/AppLayout.tsx`
- `AuthContextType`에 `isGuest`, `isSuperGuest` 추가
- Guest가 허용되지 않은 경로 접근 시 `/` 로 리다이렉트
- Guest/Super Guest일 때 쓰기 작업 차단을 위한 `readOnly` 플래그 제공

### 4. `src/components/layout/AppSidebar.tsx`
- **Guest**: Project Dashboard(`/`)만 표시
- **Super Guest**: 모든 메뉴 표시 (Admin, Import 제외)
- Footer에 "Guest" / "Super Guest" 배지 표시

### 5. `src/components/admin/AdminMembers.tsx`
- 기존 Admin 토글 버튼 옆에 Guest / Super Guest 역할 부여/해제 드롭다운 추가

### 6. `supabase/functions/admin-manage-user/index.ts`
- `toggle-admin` 액션을 확장하여 `toggle-role` 액션으로 변경 (role 파라미터로 `admin`, `guest`, `super_guest` 지원)

### 7. 각 페이지 Read-Only 처리
- `AuthContext`에서 `readOnly` 값을 제공하여, 게스트일 때 추가/수정/삭제 버튼 숨김
- Workspace, Messages, Calendar 등 주요 페이지에서 `readOnly` 체크 적용

## 권한 매트릭스

```text
메뉴              Admin  PM  일반  SuperGuest  Guest
──────────────────────────────────────────────────
Project Dashboard   ✓    ✓    ✓      ✓(R)     ✓(R)
Calendar            ✓    ✓    ✓      ✓(R)      ✗
My Dashboard        ✓    ✓    ✓      ✓(R)      ✗
My Workspace        ✓    ✓    ✓      ✓(R)      ✗
CPM Manager         ✓    ✓    ✓      ✓(R)      ✗
Messages            ✓    ✓    ✓      ✓(R)      ✗
Organization        ✓    ✓    ✓      ✓(R)      ✗
Admin               ✓    ✗    ✗       ✗        ✗
Import              ✓    ✗    ✗       ✗        ✗
(R) = Read Only
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| DB 마이그레이션 | `app_role` enum에 guest, super_guest 추가 |
| `src/hooks/useAuth.ts` | isGuest, isSuperGuest 상태 추가 |
| `src/components/layout/AppLayout.tsx` | AuthContext 확장, 라우트 가드 |
| `src/components/layout/AppSidebar.tsx` | 게스트별 메뉴 필터링, 배지 |
| `src/components/admin/AdminMembers.tsx` | 역할 관리 UI 확장 |
| `supabase/functions/admin-manage-user/index.ts` | toggle-role 액션 추가 |
| 주요 페이지들 (Workspace, Messages 등) | readOnly 시 쓰기 버튼 숨김 |

