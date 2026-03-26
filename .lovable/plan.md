

# CPM 매핑 저장 시 상태 아이콘 갱신 구현

## 변경 사항

### 1. `src/pages/CpmScheduler.tsx`
- `ActivityTaskPanel`에 `onStatusChanged={sendStatusToIframe}` prop 추가 (line 286-288)

### 2. `src/components/cpm/ActivityTaskPanel.tsx`
- `Props` 인터페이스에 `onStatusChanged?: () => void` 추가 (line 34-37)
- `MapTasksDialog`의 `onMapped` 콜백에서 `refetchMappings` 후 `onStatusChanged` 호출 (line 316)

```text
변경 전: onMapped={refetchMappings}
변경 후: onMapped={() => { refetchMappings(); onStatusChanged?.(); }}
```

### 흐름
```text
MapTasksDialog 저장 → onMapped()
  → refetchMappings() (패널 갱신)
  → onStatusChanged() → sendStatusToIframe() (iframe 노드 아이콘 갱신)
```

