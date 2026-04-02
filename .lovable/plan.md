
# KUKU 대시보드 Runtime Cache 아키텍처

## 구조

```
CPM iframe → cpm-calculated → CpmScheduler → queryClient["cpm-runtime"] (즉시)
                                            → DB upsert (비동기)

Dashboard mount → request-cpm-data → iframe → cpm-runtime-data → queryClient["cpm-runtime"]
                                                                → invalidate kuku-dashboard

useKukuDashboard → 1차: queryClient["cpm-runtime"] 캐시
                 → 2차: DB fallback (캐시 없을 때)
                 → DB: cpm_task_mappings + tasks (항상)
```

## 변경된 파일

| 파일 | 내용 |
|------|------|
| `src/lib/cpmRuntimeCache.ts` | 신규 — 타입 및 캐시 키 정의 |
| `src/pages/CpmScheduler.tsx` | cpm-calculated에서 runtime 캐시 즉시 저장, cpm-runtime-data 핸들러 추가 |
| `src/hooks/useKukuDashboard.ts` | 캐시 우선 조회, DB fallback, 레거시 코드 제거 |
| `src/pages/Index.tsx` | 마운트 시 iframe에 request-cpm-data 전송, cpm_activities Realtime 구독 제거 |
| `src/hooks/useCpmViewModel.ts` | 스냅샷 정렬 기준 updated_at DESC로 변경 |
| `public/cpm_network.html` | request-cpm-data → cpm-runtime-data 경량 응답 (DB upsert 없음) |
