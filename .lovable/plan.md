

# Fix: 태스크 매핑 시 기존 매핑이 사라지는 문제

## 원인

`handleOpen`에서 `setSelectedIds(new Set(existingMappings))`를 호출하지만, `existingMappings`는 React Query 캐시된 값입니다. 첫 번째 저장 후 다이얼로그를 다시 열면 캐시가 갱신되지 않아 **이전(저장 전) 상태**로 초기화됩니다.

또한 `handleSave`에서 기존 매핑을 모두 DELETE 후 선택된 것만 INSERT하므로, 캐시가 빈 상태면 기존 매핑이 전부 삭제됩니다.

## 수정: `src/components/cpm/MapTasksDialog.tsx`

1. **저장 후 쿼리 무효화**: `handleSave` 성공 시 `queryClient.invalidateQueries`로 `cpm_existing_mappings` 캐시 갱신
2. **다이얼로그 열 때 refetch**: `handleOpen`에서 최신 매핑을 가져오도록 `refetch()` 호출
3. **`existingMappings` 로드 완료 후 selectedIds 동기화**: `useEffect`로 변경 (현재 잘못된 `useState` 호출을 수정)

### 핵심 변경
```text
- useQuery에서 refetch 함수 추출
- handleOpen: refetch() 호출 후 최신 데이터로 selectedIds 설정
- handleSave: 성공 시 queryClient.invalidateQueries 호출
- useState(() => ...) → useEffect로 변경하여 existingMappings 변경 시 selectedIds 동기화
```

