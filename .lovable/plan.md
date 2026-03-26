

# CPM 자동 로드 실패 수정 — Parent-Driven Bootstrap 구현

## 문제 원인

새 디바이스/브라우저에서 CPM 접속 시 `localStorage`가 비어 있어 iframe이 초기화 중 `request-db-snapshot` 메시지를 parent에 전송하지만, 이 시점에 React의 `useEffect` 리스너가 아직 등록되지 않아 메시지가 유실됩니다. 이후 `loadSample()` + `calculate()`로 샘플 데이터가 로드되고, DB 스냅샷 복원은 영영 일어나지 않습니다.

스크린샷의 상태: 사이드바에 활동이 보이지만 네트워크 다이어그램은 비어 있는 것은 이 race condition의 전형적인 증상입니다.

## 해결 방법: Parent-Driven Bootstrap

iframe이 먼저 요청하는 구조에서 **parent가 iframe 준비 완료 신호를 받은 뒤 DB 데이터를 내려주는 구조**로 변경합니다.

```text
iframe init → parent에 "iframe-ready" 전송 (샘플 로드 안 함)
parent → "iframe-ready" 수신 → DB에서 name='auto' 스냅샷 조회
  → 있으면: snapshot-restore 전송
  → 없으면: bootstrap-empty 전송
iframe → snapshot-restore 수신 시 복원 + calculate
iframe → bootstrap-empty 수신 시 loadSample() + calculate()
```

## 변경 파일

### 1. `public/cpm_network.html`

**초기화 로직 변경 (lines 2603-2620):**
- `loadFromStorage()` 성공 시 기존대로 복원 + calculate
- 실패 시 `request-db-snapshot` 대신 `iframe-ready` 메시지 전송
- `loadSample()` + `calculate()` 즉시 실행하지 않음 — 대기 상태 유지

**메시지 핸들러 추가:**
- `bootstrap-empty` 수신 시 `loadSample()` + `calculate()` 실행
- `snapshot-restore` 핸들러는 기존 유지

**타임아웃 fallback:**
- `iframe-ready` 전송 후 5초 내 응답 없으면 자동으로 `loadSample()` + `calculate()` (안전장치)

### 2. `src/pages/CpmScheduler.tsx`

**`iframe-ready` 핸들러 추가 (useEffect 내부):**
- `iframe-ready` 수신 시 DB에서 `name='auto'` 스냅샷 조회
- 있으면 `snapshot-restore` 전송
- 없으면 `bootstrap-empty` 전송
- `set-role` 메시지도 함께 전송 (역할 정보 확실히 전달)

**`request-db-snapshot` 핸들러 제거:**
- 더 이상 필요 없음 (parent-driven으로 대체)

**`loadSnapshotFromDb` 변경:**
- `name='auto'` 스냅샷만 조회하도록 필터 추가

### 3. 기존 `onLoad` 콜백 정리 (`CpmScheduler.tsx` line 278-282)

- `request-cpm-data`, `set-role` 전송은 `iframe-ready` 핸들러로 이동
- `onLoad`에서 중복 전송 제거 (iframe-ready 응답에서 처리)

## 기대 효과

- 새 디바이스/타 브라우저에서도 DB 스냅샷 자동 복원 보장
- 메시지 유실 불가 (parent listener가 항상 먼저 준비됨)
- 5초 fallback으로 네트워크 오류 시에도 빈 화면 방지
- `auto` 스냅샷만 자동복원 대상으로 명확화

