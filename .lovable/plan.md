

# 노드 클릭 시 사이드바 Activity 목록 연동 선택

## 변경 내용

### `public/cpm_network.html`

**1. CSS 추가** — 선택된 activity-card 스타일:
```css
.activity-card.selected {
  border-color: var(--accent);
  background: rgba(232,197,71,.08);
}
```

**2. `handleNodeClick` 함수 수정** — 클릭된 actId에 해당하는 사이드바 카드를 선택 + 스크롤:
- `name_{actId}` input이 포함된 `.activity-card` 요소를 찾음
- 기존 `.selected` 클래스 제거 후 해당 카드에 `.selected` 추가
- `scrollIntoView({ behavior: 'smooth', block: 'center' })` 호출

**3. `renderSidebar` 함수 수정** — 각 카드에 `data-act-id` 속성 추가하여 검색 용이하게 함

### 변경 파일
| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | CSS + handleNodeClick 연동 + renderSidebar data 속성 |

