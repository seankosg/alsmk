

# Text1 뱃지 표시 및 필터 기능 추가

## 개요

`cpm_network.html` 내 좌측 Activity 사이드바 카드에 **Text1** 값을 뱃지로 표시하고, BLDG(Text2) 필터와 동일한 방식의 **Text1 필터링** 기능을 추가합니다.

## 변경 파일

`public/cpm_network.html` (단일 파일)

## 변경 내용

### 1. 사이드바 카드에 Text1 뱃지 추가 (line ~614)

BLDG 뱃지 옆에 Text1 값을 별도 색상(파란 계열)으로 표시. 클릭 시 Text1 필터 토글.

```javascript
// 기존 BLDG 뱃지 바로 뒤에 추가
${(() => { const cf = a.customFields; const tv = cf && (cf.Text1 || cf['텍스트1']); 
  return tv ? `<span onclick="event.stopPropagation(); applyText1Filter('${tv.replace(/'/g,"\\'")}')" 
  style="cursor:pointer;font-family:var(--mono);font-size:10px;color:#6ea8fe;padding:2px 5px;
  background:rgba(110,168,254,0.1);border-radius:3px;border:1px solid rgba(110,168,254,0.3)" 
  title="Text1 필터: ${tv}">${tv}</span>` : ''; })()}
```

### 2. 네트워크 노드에도 Text1 표시 (line ~1190)

BLDG 표시 옆에 Text1 값을 SVG text로 추가 (파란색).

### 3. `window._activeText1Filter` (Set) 전역 변수 추가

### 4. `applyText1Filter(value)` 함수 추가 (line ~1620)

`applyBldgFilter`와 동일한 Set 토글 로직:
- `_activeText1Filter` Set에 값 추가/제거
- `drawNetwork` 호출 시 Text1 필터도 전달

### 5. `drawNetwork` 함수 시그니처 변경

```
drawNetwork(order, map, projectEnd, filterWbs, filterBldg, filterText1)
```

`isInFilter` 내에 Text1 AND 조건 추가:
```javascript
if (hasText1Filter) {
  const cf = a.customFields;
  const tv = cf && (cf.Text1 || cf['텍스트1']) || '';
  if (!filterText1.has(tv)) return false;
}
```

### 6. 필터 칩 영역에 Text1 칩 추가 (line ~997)

파란색 칩으로 `Text1 {value} ✕` 표시, `removeText1FilterItem` 클릭 핸들러.

### 7. `clearAllFilters` 수정

`window._activeText1Filter = null` 추가.

### 8. `removeText1FilterItem(val)` 함수 추가

`removeBldgFilterItem`과 동일한 패턴.

### 9. 모든 `drawNetwork` 호출부 업데이트

`window._activeText1Filter || null` 인자 추가 (calculate, applyWbsFilter, applyBldgFilter, clearAllFilters, removeWbsFilterItem, removeBldgFilterItem 등).

## 기대 결과

- 사이드바 Activity 카드에 BLDG 뱃지(주황) + Text1 뱃지(파랑) 나란히 표시
- Text1 뱃지 클릭으로 해당 값 기준 필터 토글 (다중 선택 가능)
- BLDG, WBS, Text1 필터가 AND 조건으로 결합
- 필터 칩 영역에 개별 해제 가능한 Text1 칩 표시

