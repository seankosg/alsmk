## 목표
라우트별로 전체 화면(사이드바·헤더·본문·Portal 컴포넌트 포함)의 테마가 자동 전환되도록 한다. 사용자 토글은 없고 다크가 기본, 일부 라우트만 라이트로 강제한다.

## 라우트 → 테마 매핑 (단일 출처)

신규 파일 `src/lib/theme/routeTheme.ts`:
```ts
export type AppTheme = "dark" | "light";
// 우선순위 순서대로 매칭(상위가 먼저)
export const ROUTE_THEME_MAP: { test: (p: string) => boolean; theme: AppTheme }[] = [
  { test: (p) => p.startsWith("/design"),    theme: "light" },
  { test: (p) => p.startsWith("/workspace"), theme: "light" },
  // 추후 추가 라우트는 여기에만 등록
];
export const DEFAULT_THEME: AppTheme = "dark";
export function resolveThemeForPath(pathname: string): AppTheme {
  return ROUTE_THEME_MAP.find((m) => m.test(pathname))?.theme ?? DEFAULT_THEME;
}
```

## 전환 메커니즘 — `<html>` 클래스 토글

1. **첫 페인트 깜빡임 제거 (index.html inline 스크립트)**
   - `<head>`에 인라인 스크립트 추가: `location.pathname`을 읽어 매핑과 동일 규칙으로 `dark`/`light` 클래스를 `<html>`에 즉시 부여.
   - 매핑 규칙은 inline에 직접 하드코딩(번들 로드 전 실행 필요). 추가 라우트 변경 시 두 곳을 함께 수정해야 하므로 주석으로 명시.

2. **런타임 라우트 변경 처리**
   - 신규 컴포넌트 `src/components/theme/RouteThemeController.tsx`: `useLocation` 구독 → `resolveThemeForPath(pathname)` → `document.documentElement.classList`에 `dark`/`light` 토글.
   - `AppLayout`(또는 `App.tsx`의 Router 내부) 최상단에 마운트.
   - 라우트 변경 직후 동일 프레임에서 적용되도록 `useLayoutEffect` 사용.

3. **`light-scope` 제거**
   - `src/index.css`의 `.light-scope` 블록을 표준 Tailwind `:root.light` 토큰 블록으로 이전(현재 다크 토큰은 `:root` 또는 `.dark`에 정의되어 있는지 확인 후 정리).
   - `DesignManagement.tsx`, `Workspace.tsx`의 `light-scope` 클래스 제거(전역 토글로 대체) → 페이지는 평소처럼 semantic 토큰만 사용.

## index.css 토큰 구조 정리
```css
:root { /* 다크가 기본 — 기존 다크 토큰 그대로 */ }
:root.dark { /* 명시 (no-op이지만 일관성) */ }
:root.light {
  --background: 220 20% 98%;
  --card: 0 0% 100%;
  --primary: 215 90% 55%;
  --muted: 220 25% 96%;
  --destructive: 0 72% 51%;
  /* 기존 light-scope 토큰 전부 이전 */
  color-scheme: light;
}
```
- `light-scope` 블록 + 그 안의 스크롤바/유틸 override는 `:root.light` 하위로 이전.

## Portal 컴포넌트 일관성
- `<html class="light">` 전역 토글이므로 Toast/Tooltip/DropdownMenu/Dialog/Sheet 모두 자동으로 새 테마 적용.
- 라우트 전환 시 열려 있던 모달은 자동 닫지 않음(전환 직후 짧게 다른 테마 잔존 가능). 현 단계에서는 별도 처리 불필요(드물고 사용자가 직접 닫음).

## 차트/SVG 색상 재렌더
- Recharts/일부 SVG는 semantic 토큰(`hsl(var(--primary))` 등)을 사용하면 자동 반영. 직접 hex로 색을 prop으로 넘기는 곳이 있으면 토큰 함수로 교체.
- 라우트 변경 시 `theme` 값을 React Context(`RouteThemeContext`)로 노출해 차트가 필요 시 `key={theme}`로 강제 remount 가능하도록 준비(현 단계에서는 매핑만 노출, 실제 적용은 차트별 필요 시).

## 변경 파일 요약
- **신규**: `src/lib/theme/routeTheme.ts`, `src/components/theme/RouteThemeController.tsx`
- **수정**:
  - `index.html` — `<head>`에 첫 페인트 테마 적용 inline 스크립트 추가
  - `src/index.css` — `.light-scope` → `:root.light`로 이전, 스크롤바 override 동일 이전
  - `src/App.tsx` 또는 `src/components/layout/AppLayout.tsx` — `<RouteThemeController />` 마운트
  - `src/pages/DesignManagement.tsx`, `src/pages/Workspace.tsx` — `light-scope` 클래스 및 보정 마진 제거(전역 테마라 더 이상 필요 없음)

## 알려진 한계(이번 범위에서는 수용)
1. **추가 라우트 등록 시 두 곳 동기화**: `routeTheme.ts`와 `index.html` inline 스크립트 매핑. → 주석/명명규칙으로 관리.
2. **차트 색 즉시 갱신**: 토큰 기반 컴포넌트만 자동 반영. 하드코딩 색은 별도 PR로 정리.
3. **모달 잔존 깜빡임**: 라우트 전환 직후 모달이 열려 있을 때 한 프레임 색 어색 가능. 드문 케이스로 수용.
4. **사용자 토글 미제공**: 명시 요구. 추후 도입 시 `localStorage` override 레이어를 `resolveThemeForPath` 위에 추가하면 됨.

## 검증
1. Playwright로 `/` (dark) → `/design` (light 전환, 사이드바·헤더 포함) → `/workspace` (light) → `/calendar` (dark) 스크린샷.
2. 새로고침 시 `/design`이 처음부터 light로 페인트되어 깜빡임 없는지 확인.
3. Dropdown/Toast/Dialog가 라이트 라우트에서 라이트 톤으로 표시되는지 확인.
4. 다크 라우트(`/`)에서 기존 디자인 회귀 없는지 확인.
