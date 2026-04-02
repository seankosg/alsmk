

# KUKU Predecessor Watch: #292 → #313 관계 표시 수정

## 원인 분석

스냅샷 데이터에서 노드 A263(#313)의 선행 작업 정보:
```
predLinks: "A244:0:56,A250:1:0,A245:0:56"  ← 콤마 구분 문자열
```

**두 가지 버그가 있음:**

1. **`predLinks`가 배열이 아닌 문자열** — `.map()`을 문자열에 호출하면 실패하거나 잘못된 결과 생성
2. **ID 체계 불일치** — 스냅샷은 `A244` 형식, DB `mpp_task_id`는 `292` 형식. `actByMpp` 맵이 `mpp_task_id`로 키를 만드므로 `A244`로 조회 시 매칭 실패

## 수정: `src/hooks/useKukuDashboard.ts`

### 1. predLinks 파싱 로직 수정 (line 89~96)

```javascript
// 스냅샷에서 id → mppTaskId 매핑 테이블 구축
const snapshotIdToMpp = new Map<string, string>();
snapshotActivities.forEach((a: any) => {
  if (a.id && a.mppTaskId) snapshotIdToMpp.set(a.id, a.mppTaskId);
});

snapshotActivities.forEach((a: any) => {
  const rawPreds: string[] = [];
  
  // predecessors 처리 (문자열 또는 배열)
  if (a.predecessors) {
    if (typeof a.predecessors === "string" && a.predecessors.length > 0) {
      rawPreds.push(...a.predecessors.split(","));
    } else if (Array.isArray(a.predecessors)) {
      rawPreds.push(...a.predecessors.map(p => typeof p === "string" ? p : p.id || p.from));
    }
  }
  
  // predLinks 처리 (문자열 또는 배열)
  if (a.predLinks) {
    if (typeof a.predLinks === "string" && a.predLinks.length > 0) {
      rawPreds.push(...a.predLinks.split(",").map(s => s.split(":")[0]));
    } else if (Array.isArray(a.predLinks)) {
      rawPreds.push(...a.predLinks.map(p => typeof p === "string" ? p.split(":")[0] : p.from || p.id));
    }
  }
  
  if (rawPreds.length) {
    // 스냅샷 ID(A244)를 mppTaskId(292)로 변환
    const mppPreds = rawPreds
      .map(id => snapshotIdToMpp.get(id) || id)
      .filter(Boolean);
    const key = a.mppTaskId || a.id;
    predMap.set(key, [...new Set(mppPreds)]);
  }
});
```

### 2. actByMpp 키 유지 (변경 없음)
`mpp_task_id`("292", "313") 기준 — 이제 predMap도 같은 키 체계를 사용

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | predLinks 문자열 파싱 + 스냅샷 ID→mppTaskId 변환 |

## 예상 결과

- #292 "Receipt of 2nd TD for CRM" → #313 "SD for Steel (AFD)" 관계가 위젯에 정상 표시
- 다른 모든 선행 관계도 올바르게 표시

