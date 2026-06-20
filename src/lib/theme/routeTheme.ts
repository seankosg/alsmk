/**
 * 라우트 → 테마 매핑 (단일 출처)
 *
 * ⚠️ 추가/변경 시 `index.html`의 inline 스크립트 매핑도 함께 수정해야
 *    첫 페인트 깜빡임이 발생하지 않습니다.
 */
export type AppTheme = "dark" | "light";

export const ROUTE_THEME_MAP: { test: (p: string) => boolean; theme: AppTheme }[] = [
  { test: (p) => p.startsWith("/design"),    theme: "light" },
  { test: (p) => p.startsWith("/workspace"), theme: "light" },
];

export const DEFAULT_THEME: AppTheme = "dark";

export function resolveThemeForPath(pathname: string): AppTheme {
  return ROUTE_THEME_MAP.find((m) => m.test(pathname))?.theme ?? DEFAULT_THEME;
}
