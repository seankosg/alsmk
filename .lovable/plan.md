

# KUKU 대시보드 실시간 갱신 강화

## 현재 문제

KUKU 위젯은 `staleTime: 30_000`으로 설정되어 있어, XML 업로드 없이도 변경되는 데이터(자동 진도율, 태스크 매핑/진행률 변경)가 즉시 반영되지 않음.

## 갱신이 필요한 시나리오

| 시나리오 | 현재 | 개선 |
|---------|------|------|
| 새 XML 업로드 | ✅ invalidate 호출 | 유지 |
| CPM 페이지에서 태스크 매핑 변경 | ❌ 30초 대기 | ✅ 즉시 갱신 |
| 태스크 진행률 변경 | ❌ 30초 대기 | ✅ 즉시 갱신 |
| 대시보드 진입 시 | △ stale이면 refetch | ✅ 항상 최신 |

## 수정 사항

### 1. `src/hooks/useKukuDashboard.ts`
- `staleTime`을 `0`으로 변경하여 페이지 이동 시 항상 최신 데이터 fetch

### 2. `src/pages/Index.tsx` (대시보드)
- `cpm_activities` 테이블에 Realtime 구독 추가
- `tasks` 테이블 변경(진행률 업데이트) 시 `kuku-dashboard` 쿼리 invalidate
- `cpm_task_mappings` 변경 시에도 invalidate

```typescript
// 대시보드에 Realtime 구독 추가
useEffect(() => {
  const channel = supabase
    .channel('dashboard-kuku-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_activities' }, () => {
      queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_task_mappings' }, () => {
      queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, () => {
      queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [queryClient]);
```

### 3. Debounce 처리
Realtime 이벤트가 빠르게 연속 발생할 수 있으므로, 300ms debounce를 적용하여 불필요한 다중 쿼리 방지

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | staleTime → 0 |
| `src/pages/Index.tsx` | cpm_activities, cpm_task_mappings, tasks 테이블 Realtime 구독 추가 |

## 결과
- XML 업로드 없이도 CPM 데이터 변경 시 대시보드가 자동으로 최신 상태 유지
- 태스크 매핑/진행률 변경이 즉시 KUKU 위젯에 반영

