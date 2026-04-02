

# KUKU 위젯 자동 재계산 현황 및 수정 계획

## 현재 상태

**자동 재계산이 되지 않습니다.**

- `useKukuDashboard` 훅의 queryKey는 `["kuku-dashboard"]`
- `staleTime: 30_000` (30초) 설정으로, 30초 후에야 자동 refetch 가능
- XML 업로드 후 `upsertActivities()` 완료 시 `kuku-dashboard` 쿼리를 **invalidate하는 코드가 없음**
- 따라서 사용자가 대시보드로 돌아와도 30초 이내라면 stale 데이터가 표시됨

## 수정 방안

### `src/pages/CpmScheduler.tsx`

`cpm-calculated` 핸들러에서 upsert 완료 후 `kuku-dashboard` 쿼리를 invalidate:

```typescript
// batchUpdateElapsedProgress 완료 후
batchUpdateElapsedProgress().then(() => {
  setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
  queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
});
```

이렇게 하면 XML 업로드 → DB upsert → 진도율 재계산 → KUKU 위젯 쿼리 무효화 순서로 처리되어, 대시보드로 이동 시 최신 데이터가 즉시 표시됩니다.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | `kuku-dashboard` queryKey invalidation 추가 |

