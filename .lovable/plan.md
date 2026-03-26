

# CPM 로딩 경쟁 조건 수정

## 원인

iframe init 스크립트의 `request-db-snapshot` 메시지(line 2861)가 부모 React의 useEffect 메시지 리스너 등록보다 **먼저 실행**되어 메시지가 유실됩니다. 특히 iframe HTML이 캐시된 경우(새 기기가 아닌 다른 탭/브라우저) 더 빈번합니다. 10초 후 샘플 데이터로 폴백됩니다.

## 수정: `src/pages/CpmScheduler.tsx`

### iframe `onLoad` 핸들러에 `loadSnapshotFromDb()` 추가 (line 372-376)

```javascript
onLoad={() => {
  iframeRef.current?.contentWindow?.postMessage({ type: "set-read-only", readOnly: !isAdminOrPm }, "*");
  iframeRef.current?.contentWindow?.postMessage({ type: "request-cpm-data" }, "*");
  loadSnapshotFromDb();  // ← 추가: 경쟁 조건 방지
  setTimeout(() => sendStatusToIframe(), 300);
}}
```

iframe의 `request-db-snapshot` 메시지에 의존하지 않고, 부모가 onLoad 시점에 직접 DB 스냅샷을 조회하여 전송합니다. iframe 측 `snapshot-restore` 핸들러에서 localStorage vs DB 비교 로직이 이미 있으므로 중복 호출되어도 안전합니다.

| 파일 | 변경 |
|------|------|
| `src/pages/CpmScheduler.tsx` | onLoad에 `loadSnapshotFromDb()` 호출 추가 (1줄) |

