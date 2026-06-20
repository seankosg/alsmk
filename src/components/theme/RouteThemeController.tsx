import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { resolveThemeForPath } from "@/lib/theme/routeTheme";

/**
 * 라우트 변경 시 `<html>` 클래스를 dark/light 로 토글한다.
 * 사이드바·헤더·Portal(Toast/Dialog/Dropdown)까지 전역 영향.
 */
export function RouteThemeController() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const theme = resolveThemeForPath(pathname);
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [pathname]);

  return null;
}
