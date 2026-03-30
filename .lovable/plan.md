

# WBS Level1 기준 사이드바 Activity 접기/펼치기

## 개요

사이드바의 Activity 카드 목록을 WBS Level1 (예: `1`, `2`, `3`) 기준으로 그룹화하여 접고 펼 수 있는 collapsible 섹션으로 변경합니다.

## 변경 파일

`public/cpm_network.html` (단일 파일)

## 변경 내용

### 1. CSS 추가 (~line 130 부근)

```css
.wbs-group-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; margin: 4px 0 2px;
  cursor: pointer; user-select: none;
  font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--accent); background: var(--surface2);
  border-radius: 4px; border: 1px solid var(--border);
}
.wbs-group-header:hover { background: var(--border); }
.wbs-group-header .chevron {
  transition: transform .2s; font-size: 10px;
}
.wbs-group-header.collapsed .chevron { transform: rotate(-90deg); }
.wbs-group-cards { /* 카드 컨테이너 */ }
.wbs-group-cards.hidden { display: none; }
```

### 2. `renderSidebar()` 함수 수정 (~line 597-655)

기존: `activities.forEach` → 카드를 flat하게 append

변경:
1. Activity를 WBS Level1로 그룹화: `wbsFull.split('.')[0]` 기준
2. 각 그룹별로:
   - **그룹 헤더** div 생성 (WBS L1 값 + Activity 수 뱃지 + 접기/펼치기 chevron)
   - **카드 컨테이너** div 생성 → 기존 카드를 컨테이너에 append
3. 헤더 클릭 시 카드 컨테이너 `hidden` 토글 + chevron 방향 전환
4. `window._collapsedWbsGroups` (Set)으로 접힌 상태 유지 → renderSidebar 재호출 시에도 상태 보존

```javascript
function renderSidebar() {
  const list = document.getElementById('activityList');
  list.innerHTML = '';
  if (!window._collapsedWbsGroups) window._collapsedWbsGroups = new Set();

  // Group by WBS Level1
  const groups = new Map();
  activities.forEach(a => {
    const wbsL1 = (a.wbsFull || a.wbs || '').split('.')[0] || '기타';
    if (!groups.has(wbsL1)) groups.set(wbsL1, []);
    groups.get(wbsL1).push(a);
  });

  groups.forEach((items, wbsL1) => {
    const isCollapsed = window._collapsedWbsGroups.has(wbsL1);
    
    // Group header
    const header = document.createElement('div');
    header.className = 'wbs-group-header' + (isCollapsed ? ' collapsed' : '');
    header.innerHTML = `<span class="chevron">▼</span> WBS ${wbsL1} <span style="...">${items.length}</span>`;
    header.onclick = () => { /* toggle collapsed state, toggle container visibility */ };
    
    // Cards container
    const container = document.createElement('div');
    container.className = 'wbs-group-cards' + (isCollapsed ? ' hidden' : '');
    
    items.forEach(a => { /* 기존 카드 생성 로직 그대로 */ });
    
    list.appendChild(header);
    list.appendChild(container);
  });
}
```

### 3. 전체 접기/펼치기 단축 기능 (선택)

사이드바 헤더 영역에 "▽ 전체 펼치기 / △ 전체 접기" 토글 버튼 추가.

## 기대 결과

- WBS Level1별 그룹 헤더 표시 (예: `WBS 1 (23)`, `WBS 2 (15)`)
- 헤더 클릭으로 해당 그룹 카드 접기/펼치기
- 접힌 상태는 `renderSidebar` 재호출 시에도 유지
- 기존 카드 내용, 필터, 클릭 동작 모두 유지

