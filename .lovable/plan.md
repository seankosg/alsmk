

# 스냅샷 로딩 문제 분석 및 수정

## 현재 상태
- DB에 "auto" (382개 Activity), "3.1" (382개), "default" (260개) 스냅샷이 정상 존재
- 세션 리플레이: "3.1" 불러오기 토스트는 성공했으나 네트워크 다이어그램이 갱신되지 않음

## 발견된 문제점

### 1. `calculate()` 내 변수 스코프 문제 (핵심)
`calculate()` 함수 내 `order`, `map`, `projectEnd`가 `const`로 선언되어 함수 종료 후 소멸합니다. `activity-status-update` 핸들러(line 2760)에서 이 변수들을 참조하지만 `undefined`이므로 상태 아이콘 재렌더가 불가능합니다.

**더 중요한 문제**: `snapshot-restore` 핸들러에서 `_restoreSnapshot()` 후 `calculate()`를 호출하면 계산은 되지만, 이후 `sendStatusToIframe()` → `activity-status-update` 메시지 수신 시 `drawNetwork()`를 다시 호출할 수 없습니다.

### 2. `_restoreSnapshot` 후 상태 불일치
`_restoreSnapshot()`이 `activities` 배열은 복원하지만, 이전 `calculate()` 실행에서 생성된 DOM 요소(사이드바, 네트워크 캔버스)를 초기화하지 않아 렌더링 충돌 가능성이 있습니다.

## 수정 계획

### 파일 1: `public/cpm_network.html`

**`calculate()` 함수 끝에 전역 변수 저장 추가 (line ~898):**
```js
// calculate() 내부, calculated = true 직후
window._lastOrder = order;
window._lastMap = map;
window._lastProjectEnd = projectEnd;
```

**`activity-status-update` 핸들러 수정 (line 2760):**
```js
if (window._lastOrder && calculated) {
  drawNetwork(window._lastOrder, window._lastMap, window._lastProjectEnd, window._activeWbsFilter || null);
}
```

**`snapshot-restore` 핸들러에 디버그 로그 추가 (line 2780-2801):**
```js
if (e.data.type === 'snapshot-restore') {
  if (window._bootstrapTimeout) clearTimeout(window._bootstrapTimeout);
  const snap = e.data.snapshot;
  console.log('[CPM] snapshot-restore received, activities:', snap?.activities?.length, 'forceRestore:', e.data.forceRestore);
  if (!snap || !snap.activities || !snap.activities.length) {
    console.warn('[CPM] snapshot-restore: no activities in snapshot');
    return;
  }
  // ... 기존 localStorage 비교 로직 ...
  _restoreSnapshot(snap);
  calculated = false;
  calculate();
}
```

### 파일 2: `src/pages/CpmScheduler.tsx`

**`handleLoadSnapshot`에 로그 추가:**
```js
const handleLoadSnapshot = useCallback((snapshotData: any) => {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[CPM] handleLoadSnapshot: iframe not available');
    return;
  }
  console.log('[CPM] Sending snapshot-restore to iframe, activities:', snapshotData?.activities?.length);
  iframeRef.current.contentWindow.postMessage(
    { type: "snapshot-restore", snapshot: snapshotData, forceRestore: true },
    "*",
  );
}, []);
```

## 기대 효과
- `calculate()` 후 전역 변수 유지 → 상태 아이콘 재렌더 가능
- 디버그 로그로 메시지 수신 여부 및 데이터 구조 확인 가능
- 스냅샷 복원 → 계산 → 렌더링 파이프라인 안정화

