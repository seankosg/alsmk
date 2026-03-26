

# 사이드바 Activity 카드 클릭 → 노드 이동 + 상세 패널 열기

## 현재 상태

- 사이드바의 `.activity-card` 요소에는 클릭 이벤트 핸들러가 없음
- 네트워크 노드는 `<g transform="translate(x,y)">` SVG 그룹으로 렌더링되며 `#networkCanvas` div 내 `#svgContainer`에 위치
- `#networkCanvas`는 `overflow: auto`로 스크롤 가능

## 변경 사항

### `public/cpm_network.html`

1. **카드 클릭 핸들러 추가** (activity 카드 생성 부분, ~line 572-617):
   - 각 카드에 `onclick` 핸들러 추가
   - 클릭 시: 네트워크 탭 활성화 → 해당 노드로 스크롤 → 하이라이트 → parent에 `activity-click` 메시지 전송

2. **`scrollToNode(actId)` 함수 추가**:
   - 노드의 SVG 좌표(`positions[actId]`)를 사용하여 `#networkCanvas`의 `scrollLeft`/`scrollTop` 계산
   - 노드가 화면 중앙에 오도록 스크롤
   - 노드에 일시적 하이라이트 효과 적용

3. **카드 클릭 시 동작 흐름**:
```text
카드 클릭
  → 네트워크 탭 활성화 (현재 다른 탭이면)
  → scrollToNode(actId): 네트워크 캔버스를 해당 노드 위치로 스크롤
  → highlightSidebarCard(actId): 사이드바 카드 하이라이트
  → parent.postMessage({ type: 'activity-click', activity }): React 상세 패널 열기
```

### 변경 파일
| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | 카드에 onclick 추가, `scrollToNode` 함수 구현, `handleSidebarCardClick` 함수 추가 |

