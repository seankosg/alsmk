

# 네트워크 다이어그램 필터 해제 버튼 추가

## 현재 상태

- WBS 탭에서 클릭하면 `applyWbsFilter(wbsCode)` 호출 → 네트워크 필터 적용
- 같은 WBS를 다시 클릭하면 필터 해제 (토글)
- 필터 적용 시 `#filterLabel`에 "필터: WBS X.X" 텍스트만 표시
- **명시적 해제 버튼이 없어서** 사용자가 해제 방법을 모를 수 있음

## 변경: `public/cpm_network.html`

### filterLabel 영역에 × 해제 버튼 추가 (line 494 부근)

```html
<div class="legend-item" id="filterLabel" style="display:none;color:var(--accent);font-weight:600">
  <span id="filterText"></span>
  <span onclick="clearWbsFilter()" style="cursor:pointer;margin-left:6px;color:#ff6b6b;font-size:14px" title="필터 해제">✕</span>
</div>
```

### clearWbsFilter 함수 추가 (applyWbsFilter 아래, ~line 1462)

```javascript
function clearWbsFilter() {
  if (!window._activeWbsFilter) return;
  window._activeWbsFilter = null;
  const map = {};
  activities.forEach(a => map[a.id] = a);
  drawNetwork(order, map, projectEnd, null);
  showToast('전체 공정 표시');
}
```

### filterLabel 텍스트 업데이트 수정 (drawNetwork 내, ~line 948-954)

`lbl.textContent` 대신 `#filterText` span만 업데이트하여 × 버튼이 유지되도록 변경.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | filterLabel에 ✕ 버튼 추가, `clearWbsFilter` 함수, filterText span 분리 |

