

# CPM 네트워크 미표시 및 404 문제 종합 해결 계획

## 진단된 문제 3가지

### 1. Published 사이트 404 (캡쳐 화면의 문제)
**원인**: PWA Service Worker가 `cpm_network.html`을 포함한 모든 HTML 파일을 공격적으로 캐싱하고 있음 (`globPatterns: ["**/*.{js,css,html,...}"]`). 이전 빌드의 캐시가 남아있어 새 코드가 반영되지 않고, 경우에 따라 오래된 index.html이 서빙되어 /cpm 라우트가 404로 표시됨.

### 2. Hydration 경쟁 조건 (새 브라우저에서 CPM 빈 화면)
**원인**: iframe `onLoad` 시점에 즉시 `cpm-hydrate`를 전송하지만, iframe 내부 스크립트의 `message` 리스너 등록이 아직 완료되지 않은 경우 메시지가 유실됨. 12초 후 localStorage/sample로 폴백하면서 서버 데이터가 있는데도 빈 화면이 표시됨.

### 3. 스냅샷 조회 정렬 기준 불일치
**원인**: `useCpmViewModel.ts`에서 최신 스냅샷을 `updated_at DESC`로 조회하지만, 현재 append-only 히스토리 방식에서는 `created_at DESC`가 정확한 기준임.

## 변경 계획

### 파일 1: `vite.config.ts`
- PWA `globPatterns`에서 `html` 제거 → `**/*.{js,css,ico,png,svg,woff,woff2}`
- `cpm_network.html`이 SW 캐시에 갇히는 문제 방지
- 또는 `navigateFallbackDenylist`에 `/cpm_network.html` 추가

### 파일 2: `src/hooks/useCpmViewModel.ts`
- 스냅샷 조회 2곳의 `order("updated_at", ...)` → `order("created_at", ...)` 변경

### 파일 3: `public/cpm_network.html`
- 초기화 블록에서 `request-db-snapshot` 대신 `cpm-iframe-ready` 메시지를 부모에게 전송
- 12초 폴백에서 `loadSample()` 자동 호출 제거 → 대신 "서버 데이터 대기 중" 상태 유지 + 수동 초기화 버튼만 표시

### 파일 4: `src/pages/CpmScheduler.tsx`
- `onLoad`에서 즉시 `hydrateIframe()` 호출하는 대신, `cpm-iframe-ready` 메시지를 수신한 후에만 `hydrateIframe()` 실행
- message handler에 `cpm-iframe-ready` 타입 추가
- 기존 `request-db-snapshot` 핸들러도 호환성을 위해 유지

```text
현재 흐름:
  iframe onLoad → parent 즉시 cpm-hydrate 전송
                → iframe 리스너 미등록 시 메시지 유실
                → 12초 후 sample 폴백

개선 흐름:
  iframe 스크립트 완료 → postMessage('cpm-iframe-ready')
  parent receives ready → hydrateIframe() 실행
  iframe receives hydrate → restore → calculate → render
  hydrate 미수신 시 → 수동 초기화만 가능 (자동 sample 폴백 없음)
```

## 기대 결과
- Published 사이트에서 SW 캐시로 인한 404/빈 화면 문제 해소
- 새 브라우저 접속 시에도 DB 스냅샷이 안정적으로 로드됨
- append-only 히스토리에서 실제 최신 버전이 조회됨

