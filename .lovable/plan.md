

# 새 XML 업로드 후 자동모드 진도율 미표시 수정

## 원인

새 XML 업로드 시 흐름:
1. iframe → `cpm-calculated` (isNewImport: true) → `upsertActivities()` 실행
2. XML의 원본 progress 값(보통 0%)이 DB에 저장됨
3. `refreshStatus()`만 호출 → DB에서 progress를 읽어 iframe에 전송
4. **`batchUpdateElapsedProgress()`가 호출되지 않음** → auto 모드임에도 경과일수 기반 진도율 계산이 안 됨

반면 페이지 로드 시에는 `hydrateIframe()` → `batchUpdateElapsedProgress()` → progress 계산 후 전송하여 정상 동작

## 수정: `src/pages/CpmScheduler.tsx`

`cpm-calculated` 핸들러에서 upsert 완료 후 `batchUpdateElapsedProgress()`를 호출하고, 그 후 `refreshStatus()`를 실행하도록 변경:

```
if (e.data.type === "cpm-calculated") {
  if (isAdminOrPm) {
    if (e.data.isNewImport) {
      upsertActivities(e.data.activities);
    } else {
      upsertActivitiesOnly(e.data.activities);
    }
  }
  // 자동 진도율 갱신 후 상태 전송
  batchUpdateElapsedProgress().then(() => {
    setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
  });
}
```

또한 `upsertActivities`와 `upsertActivitiesOnly` 내부의 `setTimeout(() => refreshStatus(...), 500)` 호출은 중복이므로 제거하거나, 외부 핸들러의 호출과 타이밍을 조정하여 이중 호출을 방지

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | cpm-calculated 핸들러에 batchUpdateElapsedProgress 호출 추가 |

