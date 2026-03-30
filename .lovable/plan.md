

# Text1/Text2 필터 뱃지 버튼을 사이드바 상단에 고정 배치

## 개요

현재 Text1(사업본부)과 Text2(BLDG) 필터는 사이드바 카드 내 뱃지를 클릭해야만 적용 가능합니다. 이를 사이드바 최상단(전체 펼치기 버튼 왼쪽)에 고유값 뱃지 버튼으로 고정 배치하여, 스크롤 없이 바로 필터를 적용/해제할 수 있게 합니다.

## 변경 파일

`public/cpm_network.html` (단일 파일)

## 변경 내용

### 1. HTML: `toggleAllContainer` 위에 필터 뱃지 컨테이너 추가 (~line 509)

```html
<div id="sidebarFilterBadges" style="padding:4px 8px 0;flex-shrink:0;display:none;flex-wrap:wrap;gap:4px;align-items:center"></div>
<div id="toggleAllContainer" style="padding:4px 8px 0;flex-shrink:0;display:none"></div>
```

### 2. `renderSidebar()` 내에서 필터 뱃지 렌더링 로직 추가 (~line 638 부근)

- 모든 activity에서 Text1, Text2(BLDG) 고유값 수집
- 각 고유값을 뱃지 버튼으로 렌더링
  - Text2(BLDG): 주황 계열 (`#c97a10`), 클릭 시 `applyBldgFilter(val)` 호출
  - Text1(사업본부): 파랑 계열 (`#6ea8fe`), 클릭 시 `applyText1Filter(val)` 호출
- 현재 활성 필터(`window._activeBldgFilter`, `window._activeText1Filter`)에 포함된 값은 배경 강조(활성 상태 표시)
- 값이 하나도 없으면 컨테이너 숨김

```javascript
// renderSidebar() 내부, toggleContainer 로직 앞에 추가
const filterBadgesEl = document.getElementById('sidebarFilterBadges');
const bldgVals = new Set();
const text1Vals = new Set();
activities.forEach(a => {
  const cf = a.customFields || {};
  const bv = cf.BLDG || cf.Text2 || cf['텍스트2'];
  const tv = cf.Text1 || cf['텍스트1'];
  if (bv) bldgVals.add(bv);
  if (tv) text1Vals.add(tv);
});
let badgeHtml = '';
// BLDG badges (주황)
bldgVals.forEach(v => {
  const active = window._activeBldgFilter?.has(v);
  badgeHtml += `<span onclick="applyBldgFilter('${v}')" style="cursor:pointer;font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid rgba(201,122,16,${active?'0.8':'0.3'});color:#c97a10;background:rgba(201,122,16,${active?'0.25':'0.08'})">${v}</span>`;
});
// Text1 badges (파랑)
text1Vals.forEach(v => {
  const active = window._activeText1Filter?.has(v);
  badgeHtml += `<span onclick="applyText1Filter('${v}')" style="cursor:pointer;font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid rgba(110,168,254,${active?'0.8':'0.3'});color:#6ea8fe;background:rgba(110,168,254,${active?'0.25':'0.08'})">${v}</span>`;
});
filterBadgesEl.style.display = badgeHtml ? 'flex' : 'none';
filterBadgesEl.innerHTML = badgeHtml;
```

### 3. 필터 적용/해제 후 사이드바 재렌더링

`applyBldgFilter`, `applyText1Filter`, `clearAllFilters`, `removeBldgFilterItem`, `removeText1FilterItem` 함수 말미에 `renderSidebar()` 호출 추가 (뱃지 활성 상태 갱신).

### 4. `toggleAllContainer` 레이아웃 조정

필터 뱃지 행과 전체 접기/펼치기 버튼을 한 줄에 배치하는 대안:

```html
<div id="sidebarFixedControls" style="padding:4px 8px 0;flex-shrink:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
  <div id="sidebarFilterBadges" style="display:flex;flex-wrap:wrap;gap:3px;flex:1"></div>
  <div id="toggleAllContainer"></div>
</div>
```

이렇게 하면 뱃지들이 왼쪽, 전체 접기/펼치기가 오른쪽에 같은 줄로 고정됩니다.

## 기대 결과

- 사이드바 최상단에 BLDG(주황) + Text1(파랑) 필터 뱃지가 고정 표시
- 스크롤해도 위치 유지 (기존 `toggleAllContainer`와 동일한 `flex-shrink:0` 영역)
- 뱃지 클릭으로 필터 토글, 활성 필터는 배경 강조로 시각적 구분
- 기존 카드 내 뱃지 클릭 필터도 그대로 유지

