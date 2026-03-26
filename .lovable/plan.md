

# BLDG 필터 기능 추가

## 개요

WBS 다중 필터와 동일한 패턴으로 BLDG(커스텀 필드) 기반 네트워크 필터를 추가합니다. WBS 필터와 BLDG 필터는 **AND 조건**으로 결합됩니다 (둘 다 활성 시 양쪽 모두 만족하는 노드만 표시).

## 변경: `public/cpm_network.html`

### 1. 전역 상태 추가

```javascript
window._activeBldgFilter = null; // Set | null (WBS와 동일 패턴)
```

### 2. `drawNetwork` 수정 (~line 924)

- 두 번째 필터 파라미터 추가: `filterBldg` (Set | null)
- `isInFilter`를 WBS + BLDG AND 조건으로 확장:

```javascript
function drawNetwork(order, map, projectEnd, filterWbs, filterBldg) {
  const hasWbsFilter = filterWbs && filterWbs.size > 0;
  const hasBldgFilter = filterBldg && filterBldg.size > 0;
  const isInFilter = id => {
    const a = map[id];
    // WBS 체크
    if (hasWbsFilter) {
      const code = a.wbsFull || a.wbs || '';
      let wbsMatch = false;
      for (const fw of filterWbs) {
        if (code === fw || code.startsWith(fw + '.')) { wbsMatch = true; break; }
      }
      if (!wbsMatch) return false;
    }
    // BLDG 체크
    if (hasBldgFilter) {
      const cf = a.customFields;
      const bv = cf && (cf.BLDG || cf.Text2 || cf['텍스트2']) || '';
      if (!filterBldg.has(bv)) return false;
    }
    return true;
  };
  // ...
}
```

- filterLabel 텍스트에 BLDG 필터 정보도 포함:
  - `"필터: WBS 1.1, 2.3 | BLDG A, B"`

### 3. `applyBldgFilter(bldgValue)` 함수 추가 (~line 1490)

WBS 필터와 동일한 Set 토글 패턴:

```javascript
function applyBldgFilter(bldgValue) {
  if (!calculated) { showToast('먼저 CPM 계산을 실행하세요'); return; }
  if (!window._activeBldgFilter) window._activeBldgFilter = new Set();
  if (window._activeBldgFilter.has(bldgValue)) {
    window._activeBldgFilter.delete(bldgValue);
  } else {
    window._activeBldgFilter.add(bldgValue);
  }
  if (window._activeBldgFilter.size === 0) window._activeBldgFilter = null;
  // redraw
  const map = {}; activities.forEach(a => { map[a.id] = a; });
  const order = getOrder(map); if (!order) return;
  const projectEnd = Math.max(...activities.map(a => a.ef || 0));
  drawNetwork(order, map, projectEnd, window._activeWbsFilter, window._activeBldgFilter);
  showToast(window._activeBldgFilter ? `BLDG 필터: ${[...window._activeBldgFilter].join(', ')}` : '전체 BLDG 표시');
}
```

### 4. `clearWbsFilter` → `clearAllFilters`로 확장 (~line 1491)

- BLDG 필터도 함께 초기화
- 기존 ✕ 버튼이 양쪽 모두 해제

### 5. BLDG 필터 UI — 사이드바 카드 BLDG 배지 클릭 (~line 586)

사이드바 카드의 BLDG 배지에 `onclick` 추가하여 클릭 시 `applyBldgFilter(bldgValue)` 호출:

```html
<span onclick="event.stopPropagation(); applyBldgFilter('${bv}')" 
  style="cursor:pointer;..." title="BLDG 필터: ${bv}">${bv}</span>
```

### 6. 네트워크 노드의 BLDG 텍스트에도 클릭 이벤트 (~line 1141)

SVG `<text>` 요소에 `onclick` + `cursor:pointer` 추가.

### 7. 모든 `drawNetwork` 호출 업데이트

기존 `drawNetwork(order, map, projectEnd, window._activeWbsFilter)` 호출을 모두 `drawNetwork(order, map, projectEnd, window._activeWbsFilter, window._activeBldgFilter)`로 변경.

### 8. 스냅샷 저장/복원

- 저장 시 `bldgFilter: window._activeBldgFilter ? [...window._activeBldgFilter] : null`
- 복원 시 `window._activeBldgFilter = snap.bldgFilter ? new Set(snap.bldgFilter) : null`

## 변경 파일

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | BLDG 필터 전역 상태, `drawNetwork` AND 조건, `applyBldgFilter`, 클리어 확장, BLDG 배지 클릭, 스냅샷 |

