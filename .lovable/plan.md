

# `getOrder()` predecessor 불일치 버그 수정

## 문제
`getOrder()` (line 1956-1988)가 `predecessors` + `predLinks` 합집합으로 in-degree를 계산하지만, `successors` 배열은 `calculate()` 시 `predLinks` 기준으로만 구성됨. stale predecessor가 있으면 in-degree가 영원히 0이 되지 않아 노드가 order에서 누락됨.

## 수정: `public/cpm_network.html`

### `getOrder()` 함수를 `calculate()`와 동일한 규칙으로 교체 (lines 1956-1988)

```javascript
function getOrder(map) {
  // calculate()와 동일: predLinks 우선, 없으면 predecessors
  const inDeg = {};
  const succs = {};
  activities.forEach(a => { inDeg[a.id] = 0; succs[a.id] = []; });
  activities.forEach(a => {
    const rawStr = (a.predLinks && a.predLinks.trim())
      ? a.predLinks
      : (a.predecessors || '');
    rawStr.split(',').forEach(token => {
      const pid = token.trim().split(':')[0].trim();
      if (pid && map[pid]) {
        inDeg[a.id]++;
        succs[pid].push(a.id);
      }
    });
  });
  const queue = activities.filter(a => inDeg[a.id] === 0).map(a => a.id);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    succs[cur].forEach(sid => {
      inDeg[sid]--;
      if (inDeg[sid] === 0) queue.push(sid);
    });
  }
  return order;
}
```

핵심 변경:
1. `predecessors` + `predLinks` 합집합 → `predLinks` 우선 규칙으로 통일
2. `map[cur].successors` 의존 제거 → 자체 `succs` 맵을 구성하여 in-degree 감소가 정확히 매칭됨
3. XML 재업로드 없이 기존 스냅샷/데이터로 즉시 해결

