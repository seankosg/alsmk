

# WBS 다중 필터 기능

## 현재 상태

- `window._activeWbsFilter`는 단일 문자열 (`"1.1"` 등)
- WBS 클릭 시 토글 (같은 코드 재클릭 → 해제)
- `drawNetwork`의 `filterWbs` 파라미터도 단일 문자열
- `isInFilter`에서 `code === filterWbs || code.startsWith(filterWbs + '.')` 단일 비교

## 변경: `public/cpm_network.html`

### 1. 데이터 구조 변경

```text
변경 전: window._activeWbsFilter = "1.1"  (string | null)
변경 후: window._activeWbsFilter = new Set(["1.1", "2.3"])  (Set | null)
```

### 2. `applyWbsFilter` 수정 (~line 1445)

- Set 기반 토글: 이미 있으면 제거, 없으면 추가
- Set이 비면 null로 초기화
- Toast에 현재 필터 목록 표시

### 3. `clearWbsFilter` 수정 (~line 1471)

- Set을 null로 초기화

### 4. `drawNetwork` 수정 (~line 924)

- `filterWbs` 파라미터: `Set | null`로 변경
- `isInFilter`: Set 내 어느 WBS에든 속하면 통과

```javascript
const isInFilter = id => {
  if (!filterWbs || filterWbs.size === 0) return true;
  const code = (map[id].wbsFull || map[id].wbs || '');
  for (const fw of filterWbs) {
    if (code === fw || code.startsWith(fw + '.')) return true;
  }
  return false;
};
```

### 5. filterLabel 업데이트 (~line 948)

- 다중 WBS 표시: `"필터: WBS 1.1, 2.3"`

### 6. 스냅샷 저장/복원 (~line 2586, 2611, 2634, 2666)

- `wbsFilter`를 배열로 저장/복원 → Set 변환

### 7. WBS 탭 하이라이트 (~line 1390-1422)

- 선택된 WBS 노드에 active 스타일 표시 (현재 단일 비교 → Set.has로 변경)

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | `_activeWbsFilter`를 Set으로 변경, 관련 함수 전부 수정 |

