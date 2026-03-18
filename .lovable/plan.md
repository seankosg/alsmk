

## 서비스 워커 기반 캐시 자동 갱신

### 개요
새 버전 배포 시 브라우저가 자동으로 캐시를 갱신하도록 서비스 워커를 추가합니다. `vite-plugin-pwa`를 사용하여 빌드 시 자동으로 서비스 워커를 생성하고, 새 버전 감지 시 사용자에게 알림 후 즉시 갱신합니다.

### 변경 사항

| 파일 | 변경 |
|------|------|
| `package.json` | `vite-plugin-pwa` 의존성 추가 |
| `vite.config.ts` | `VitePWA` 플러그인 설정 — `registerType: 'prompt'`, 캐시 전략 설정 |
| `src/main.tsx` | SW 등록 및 업데이트 감지 시 `window.location.reload()` 호출 |
| `public/manifest.json` | 기본 PWA manifest 파일 생성 |

### 동작 방식
1. 빌드 시 `vite-plugin-pwa`가 precache manifest를 포함한 서비스 워커 자동 생성
2. 사용자가 사이트 방문 시 SW 등록, 에셋 캐싱
3. 새 배포 후 사용자 재방문 시 SW가 새 버전 감지
4. 자동으로 새 SW 활성화 후 페이지 리로드 → 항상 최신 버전 표시

DB 변경 없음.

