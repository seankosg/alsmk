

# 네트워크 필터 적용 시 매핑 버튼 미표시 — 원인 분석 및 수정 계획

## 원인 분석

`ActivityTaskPanel`에서 매핑 버튼은 `dbActivity?.id`가 존재할 때만 렌더링됩니다 (line 373).

`dbActivity` 조회 쿼리 (line 67-83):
```javascript
let query = supabase.from("cpm_activities").select("id");
if (activity.mppTaskId) {
  query = query.eq("mpp_task_id", activity.mppTaskId);
}
if (activity.wbsFull) {
  query = query.eq("wbs_full", activity.wbsFull);
}
const { data } = await query.maybeSingle();
```

**문제점**: `mpp_task_id`는 XML 재 Export 시 값이 변할 수 있고, **DB 유니크 제약이 `mpp_uid, wbs_full`로 변경**되었기 때문에 `mpp_task_id`로 조회하면:
1. **중복 매칭**: 같은 `mpp_task_id + wbs_full` 조합이 여러 행에 존재 → `.maybeSingle()`이 에러 반환 → `data = null`
2. **불일치**: DB에는 `mpp_uid`가 기준인데 `mpp_task_id`로 조회하면 매칭 실패

필터와의 관계: 필터가 없을 때는 이미 열린 패널의 캐시된 `dbActivity`가 유지되지만, **필터 적용 후 다른 노드를 클릭하면 새 쿼리가 실행**되고 이때 조회 실패가 발생합니다.

## 수정 계획

### 변경 파일: `src/components/cpm/ActivityTaskPanel.tsx`

**dbActivity 조회를 `mpp_uid + wbs_full` 기반으로 변경** — DB 유니크 제약과 일치시킴:

```javascript
const { data: dbActivity } = useQuery({
  queryKey: ["cpm_activity_by_mpp", activity.mppUid, activity.wbsFull],
  queryFn: async () => {
    let query = supabase.from("cpm_activities").select("id");
    
    // Primary: mpp_uid + wbs_full (DB unique constraint)
    if (activity.mppUid) {
      query = query.eq("mpp_uid", activity.mppUid);
    }
    if (activity.wbsFull) {
      query = query.eq("wbs_full", activity.wbsFull);
    }
    
    // Fallback: mpp_task_id + wbs_full
    if (!activity.mppUid && activity.mppTaskId) {
      query = supabase.from("cpm_activities").select("id")
        .eq("mpp_task_id", activity.mppTaskId);
      if (activity.wbsFull) query = query.eq("wbs_full", activity.wbsFull);
    }
    
    // Last resort: name match
    if (!activity.mppUid && !activity.mppTaskId) {
      query = supabase.from("cpm_activities").select("id")
        .eq("name", activity.name);
    }
    
    const { data } = await query.maybeSingle();
    return data;
  },
});
```

### 핵심 변경 사항

| 항목 | 기존 | 변경 |
|------|------|------|
| 조회 키 | `mpp_task_id` + `wbs_full` | `mpp_uid` + `wbs_full` (DB 유니크 제약과 일치) |
| queryKey | `activity.id` (iframe 내부 ID) | `activity.mppUid, activity.wbsFull` (안정적) |
| Fallback | `name` only | `mpp_task_id` → `name` 2단계 |

## 기대 효과

- DB 유니크 제약(`mpp_uid, wbs_full`)과 조회 로직이 일치하여 `.maybeSingle()`이 정확히 1행 반환
- 필터 적용 여부와 무관하게 모든 노드 클릭 시 매핑 버튼 정상 표시
- `mpp_uid`는 XML 재 Export에도 불변이므로 안정적 매칭

