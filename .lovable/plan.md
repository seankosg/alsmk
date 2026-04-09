

# Import 버튼 일반 사용자 접근 문제 수정

## 원인

`src/components/layout/AppLayout.tsx` (line 78)에서 `/tasks/import` 경로가 admin 전용으로 제한되어 있습니다:

```tsx
if (!auth.isAdmin && (location.pathname === "/admin" || location.pathname === "/tasks/import")) {
    return <Navigate to="/" replace />;
}
```

일반 사용자가 Import 버튼을 클릭하면 `/tasks/import`로 이동하지만, 라우트 가드에 의해 즉시 `/`로 리다이렉트됩니다.

## 해결 방안

`AppLayout.tsx`의 라우트 가드에서 `/tasks/import`를 admin 전용 경로에서 제거하여, `readOnly`가 아닌 일반 사용자도 접근 가능하게 합니다.

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/layout/AppLayout.tsx` | line 78: `/tasks/import` 조건을 admin 전용 가드에서 제거하고, 별도로 `readOnly` 사용자만 차단하는 가드 추가 |

### 변경 후 코드

```tsx
// Admin-only: /admin
if (!auth.isAdmin && location.pathname === "/admin") {
  return <Navigate to="/" replace />;
}

// Import: readOnly 사용자 차단
if (auth.readOnly && location.pathname === "/tasks/import") {
  return <Navigate to="/" replace />;
}
```

이렇게 하면 일반 사용자(non-admin, non-guest)는 Import 페이지에 접근할 수 있고, guest/super_guest는 여전히 차단됩니다.

