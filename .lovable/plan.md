

# Admin View 미표시 원인 분석 및 수정 계획

## 원인

`useAuth`의 `onAuthStateChange`에서 `setTimeout(async () => {...}, 0)` 을 사용하여 역할 조회를 비동기로 지연합니다. 문제는:

1. **`onAuthStateChange`가 여러 번 fire** — `INITIAL_SESSION`, `TOKEN_REFRESHED` 등 이벤트마다 새 `setTimeout`이 예약됨
2. **경쟁 조건** — 첫 번째 `setTimeout` 콜백이 `await Promise.all()`로 DB 조회 중일 때, 두 번째 이벤트가 fire되면 또 다른 `setTimeout`이 예약됨. 두 번째 콜백이 먼저 완료되면 `isAdmin: true`를 설정하지만, 뒤늦게 완료된 첫 번째 콜백이 다시 `isAdmin: false`로 덮어쓸 수 있음
3. **RPC 실패 무시** — `roleResult.error`를 체크하지 않음. 네트워크 타이밍이나 토큰 전파 지연으로 RPC가 실패하면 `roleResult.data`가 `null`이 되어 `admin = false`로 설정됨

### Workspace 측 영향

`Workspace.tsx` line 67: `const showTabs = !isAdmin && !isPm` — `isAdmin`이 `false`로 잘못 설정되면 일반 사용자 뷰(탭 표시)가 나타남

## 수정 계획

### 변경 파일: `src/hooks/useAuth.ts`

1. **`setTimeout` 제거, 직접 `getSession()` 기반으로 변경** — `onAuthStateChange` 내부에서는 user/session만 즉시 설정하고, 역할 조회는 별도 함수로 분리
2. **중복 호출 방지** — 현재 처리 중인 user ID를 추적하여 동일 사용자에 대한 중복 역할 조회 방지
3. **에러 핸들링 추가** — RPC 실패 시 재시도 또는 기존 상태 유지

```text
변경 로직:

onAuthStateChange:
  session 있음 → user/session만 즉시 setState (loading 유지)
                → fetchRoles(session.user.id) 호출
  session 없음 → 초기화 + loading: false

fetchRoles(userId):
  if (이미 같은 userId 처리 중) return;
  처리중 플래그 설정
  Promise.all([has_role RPC, members 조회])
  에러 없으면 → setState (isAdmin, isPm 등 + loading: false)
  에러 있으면 → 기존 값 유지 + loading: false
  처리중 플래그 해제
```

### 기대 효과

- `setTimeout` 경쟁 조건 제거
- RPC 실패 시에도 안정적 동작
- Admin 로그인 시 항상 정확한 역할 표시

