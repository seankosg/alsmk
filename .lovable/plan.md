
# 빌드 버전 자동 감지 & 리로드 시스템 추가

## ⚠️ 사전 확인
참조하신 `sean-asset-portfolio88` 프로젝트를 검사한 결과 **`src/components/BuildInfo.tsx` 파일과 빌드 버전 감지 로직이 실제로 존재하지 않습니다** (해당 프로젝트는 단순 PWA `autoUpdate`만 설정됨). 따라서 1:1 복제가 불가하여, 사용자의 의도에 맞는 **표준 구현**을 ALSMK에 새로 설계합니다.

## 구현 전략

기존 `vite-plugin-pwa` 인프라를 활용하면서, **빌드 시각 기반 폴링 + 헤더 칩 + 새 버전 감지 시 토스트 알림**을 추가합니다.

| 영역 | 변경 내용 |
|------|-----------|
| **빌드 시각 주입** | `vite.config.ts`에 `define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) }` 추가 |
| **타입 선언** | `src/vite-env.d.ts`에 `declare const __BUILD_TIME__: string` 추가 |
| **버전 엔드포인트** | `public/version.json`은 빌드 시 갱신이 어려우므로, `index.html`에 `<meta name="build-time">` 주입 후 fetch로 비교 |
| **신규 컴포넌트** | `src/components/BuildInfo.tsx` 생성 — `inline` prop 지원, 빌드 시각 칩 표시, 5분마다 `index.html` HEAD 재fetch하여 build-time meta 비교, 변경 감지 시 toast + 클릭 시 `location.reload(true)` |
| **헤더 배치** | `src/components/layout/AppLayout.tsx` 헤더의 NotificationBell 옆에 `<BuildInfo inline />` 삽입 |
| **PWA 통합** | 기존 `main.tsx`의 `registerSW onNeedRefresh`도 동일 토스트로 통합하여 중복 알림 방지 |

## 동작 방식

1. **빌드 시각 표시**: 헤더 우측에 `🔨 v25.04.26 14:32` 형태의 작은 칩 (monospace, muted 색상)
2. **자동 감지**: 5분마다 `/index.html?t={now}` fetch → HTML 내 `<meta name="build-time">` 값 추출 → 현재 `__BUILD_TIME__`과 비교
3. **새 버전 발견 시**: 
   - 칩에 파란 점(●) 표시
   - Sonner toast: "새 버전이 배포되었습니다" + [새로고침] 액션 버튼
4. **수동 새로고침**: 칩 클릭 시 즉시 강제 리로드 (`window.location.reload()`)
5. **PWA SW 업데이트**: `onNeedRefresh` 콜백도 동일 toast로 통합

## 변경 파일 (5개)

### 1. `vite.config.ts`
```ts
export default defineConfig(({ mode }) => ({
  // ... 기존 ...
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // ... 기존 ...
}));
```

### 2. `src/vite-env.d.ts`
```ts
declare const __BUILD_TIME__: string;
```

### 3. `index.html` (head 내)
```html
<meta name="build-time" content="%BUILD_TIME%" />
```
→ Vite의 HTML 변환 플러그인 추가 또는 빌드 시 자동 치환되는 방식 사용. 더 간단하게는 **빌드 시각 비교를 `/assets/index-{hash}.js` 파일명 변화로 대체**하는 fallback도 함께 구현.

### 4. `src/components/BuildInfo.tsx` (신규)
```tsx
interface BuildInfoProps { inline?: boolean }

export function BuildInfo({ inline = false }: BuildInfoProps) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const buildTime = __BUILD_TIME__;
  const formatted = format(new Date(buildTime), "yy.MM.dd HH:mm");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
        const html = await res.text();
        const match = html.match(/<script[^>]*src="([^"]*index-[^"]+\.js)"/);
        const currentScript = document.querySelector('script[src*="index-"]')?.getAttribute("src");
        if (match && currentScript && match[1] !== currentScript) {
          setHasUpdate(true);
          toast.info("새 버전이 배포되었습니다", {
            action: { label: "새로고침", onClick: () => window.location.reload() },
            duration: Infinity,
          });
        }
      } catch {}
    };
    const id = setInterval(check, 5 * 60 * 1000);
    check();
    return () => clearInterval(id);
  }, []);

  return (
    <button
      onClick={() => hasUpdate && window.location.reload()}
      className={cn(
        "font-mono text-[10px] px-2 py-0.5 rounded-full border",
        hasUpdate
          ? "border-primary text-primary animate-pulse cursor-pointer"
          : "border-border text-muted-foreground/60 cursor-default"
      )}
      title={`Build: ${buildTime}`}
    >
      🔨 {formatted}{hasUpdate && " ●"}
    </button>
  );
}
```

### 5. `src/components/layout/AppLayout.tsx` (헤더 우측)
```tsx
<div className="flex items-center gap-2 sm:gap-3 shrink-0">
  <BuildInfo inline />
  <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">© ...</span>
  {!auth.readOnly && <NotificationBell />}
</div>
```

### 6. `src/main.tsx` (기존 onNeedRefresh 통합)
```tsx
const updateSW = registerSW({
  onNeedRefresh() {
    toast.info("새 버전이 배포되었습니다", {
      action: { label: "새로고침", onClick: () => updateSW(true) },
      duration: Infinity,
    });
  },
  onOfflineReady() { console.log("App ready for offline use"); },
});
```

## 모바일 (430px) 대응
- 헤더 우측 공간이 좁으므로 모바일에서는 칩에서 🔨 아이콘만 표시 (`hidden sm:inline` 으로 시각 텍스트 숨김)
- 새 버전 감지 시에는 모바일에서도 빨간 점(●)이 보이도록 함

## 영향 범위
- 기존 PWA 로직 보존 (단순 통합)
- DB/RLS 변경 없음
- 모든 사용자(Admin/PM/Member/Guest)에게 헤더 칩 표시
