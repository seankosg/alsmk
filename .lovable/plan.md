

# KUKU Predecessor Watch: 스냅샷 의존성 완전 제거

## 근본 원인

`pred_links` 컬럼에 iframe 내부 ID(`A244:0:56,A250:1:0`)가 그대로 저장됨. `useKukuDashboard`는 이 A### ID를 mppTaskId로 변환하기 위해 **여전히 최신 스냅샷을 조회**하고 있음 (lines 80-93). 새 XML 업로드 시 스냅샷이 아직 저장되지 않았거나 이전 버전이면 매핑 실패.

## 해결: DB 저장 시 mppTaskId로 변환

`cpm-calculated` 메시지에는 모든 activity의 `id`(A###)와 `mppTaskId`가 포함되어 있으므로, **CpmScheduler에서 upsert 시점에 pred_links를 mppTaskId 기반으로 변환하여 저장**하면 스냅샷 의존성이 완전히 제거됨.

## 변경 사항

### 1. `src/pages/CpmScheduler.tsx`
- upsert 전에 `internalIdToMpp` 맵을 activities 배열에서 구축
- `pred_links` 저장 시 A### → mppTaskId 변환

```typescript
// activities 배열에서 내부ID→mppTaskId 맵 구축
const idToMpp = new Map<string, string>();
activities.forEach((a: any) => {
  if (a.id && a.mppTaskId) idToMpp.set(a.id, a.mppTaskId);
});

// pred_links 변환 함수
const convertPredLinks = (raw: string | null): string | null => {
  if (!raw?.trim()) return null;
  return raw.split(",")
    .map(s => {
      const parts = s.trim().split(":");
      const converted = idToMpp.get(parts[0].trim()) || parts[0].trim();
      parts[0] = converted;
      return parts.join(":");
    })
    .join(",");
};

// upsert rows에서
pred_links: convertPredLinks((a as any).predLinks || null),
```

두 곳 모두 적용 (upsertActivities, upsertActivitiesOnly)

### 2. `src/hooks/useKukuDashboard.ts`
- 스냅샷 조회 코드 **완전 제거** (lines 79-93)
- `pred_links`가 이미 mppTaskId 형식이므로 직접 파싱

```typescript
// 스냅샷 조회 제거, 직접 파싱
activities.forEach((a) => {
  const raw = (a as any).pred_links as string | null;
  if (!raw?.trim() || !a.mpp_task_id) return;
  const predMppIds = raw.split(",")
    .map(s => s.trim().split(":")[0].trim())
    .filter(Boolean);
  if (predMppIds.length) {
    predMap.set(a.mpp_task_id, [...new Set(predMppIds)]);
  }
});
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | upsert 시 pred_links를 mppTaskId로 변환하여 저장 |
| `src/hooks/useKukuDashboard.ts` | 스냅샷 조회 제거, pred_links 직접 파싱 |

## 결과
- XML 업로드 → activities upsert(pred_links 이미 mppTaskId) → invalidate → 대시보드 즉시 최신 데이터 표시
- 스냅샷 저장 타이밍과 완전히 독립

