

# highlight 노드 이동 수정 — searchParams 반응형 전환

## 원인 (1줄 요약)
`useRef` + `useEffect([])` 조합은 keep-alive 컴포넌트에서 URL 변경을 감지하지 못함

## 변경: `src/pages/CpmScheduler.tsx`

**삭제** (line 37):
```typescript
const highlightNodeRef = useRef<string | null>(searchParams.get("highlight"));
```

**교체** (line 40~51의 useEffect):
```typescript
const highlightParam = searchParams.get("highlight");

useEffect(() => {
  if (!highlightParam) return;
  
  // URL에서 param 제거 (재트리거 방지)
  setSearchParams((prev) => { prev.delete("highlight"); return prev; }, { replace: true });
  
  // iframe에 focus-node 전송 (로딩 타이밍 대비 재시도)
  const trySend = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: "focus-node", nodeId: highlightParam }, "*");
  };
  const timers = [500, 1500, 3000].map((d) => setTimeout(trySend, d));
  
  // ActivityTaskPanel 자동 열기 (기존 DB 조회 로직 그대로)
  (async () => { /* 기존 mpp_task_id/id 조회 → setSelectedActivity */ })();
  
  return () => timers.forEach(clearTimeout);
}, [highlightParam]);
```

핵심: `useRef` 기반 1회 실행 → `searchParams.get("highlight")` 값을 의존성으로 감시하여 URL 변경 시마다 재실행.

변경량: ~15줄 수정, 로직 변경 없음 (감시 방식만 전환)

