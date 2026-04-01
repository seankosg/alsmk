

# CPM 노드 Overdue 시각화 개선 — 빨간 깜박임 + 경고 아이콘 크기

## 문제 분석

1. **빨간 깜박임 미작동**: `node-alert-blink` CSS 클래스가 메인 `<rect>`에 적용되어 `opacity` 전체(fill 포함)를 깜박임 → fill이 어두운 색이라 시각적 차이가 거의 없음
2. **⚠ 아이콘 시인성**: `font-size="9"`, 위치가 `NODE_W-6, y=11`로 다른 텍스트(BLDG, Text1)와 겹침

## 변경: `public/cpm_network.html`

### 1. CSS 애니메이션 개선 (line 44-45)

현재 `opacity` 기반 → **stroke 전용 글로우 rect**를 별도 레이어로 추가하는 방식으로 변경:

```css
@keyframes alertBlink {
  0%, 100% { stroke-opacity: 1; filter: drop-shadow(0 0 6px #ff4d4d); }
  50% { stroke-opacity: 0.2; filter: drop-shadow(0 0 1px #ff4d4d); }
}
.node-alert-blink { animation: alertBlink 1.2s ease-in-out infinite; }
```

→ fill은 그대로, **테두리(stroke)만 글로우 효과로 깜박임**

### 2. 메인 rect에서 blink 분리 (line 1447-1448)

현재: 메인 rect에 `class="${alertBlinkClass}"` 적용
변경: 메인 rect는 class 제거, **별도 overlay rect 추가**:

```svg
<!-- 기존 메인 rect (fill 담당, 깜박임 없음) -->
<rect width="${NODE_W}" height="${NODE_H}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />
<!-- critical일 때만 추가되는 글로우 rect -->
<rect class="node-alert-blink" width="${NODE_W}" height="${NODE_H}" rx="6"
  fill="none" stroke="#ff4d4d" stroke-width="3" />
```

### 3. ⚠ 아이콘 크기 및 위치 개선 (line 1385-1387)

| 항목 | 현재 | 변경 |
|------|------|------|
| font-size | 9 | 13 |
| 위치 | `NODE_W-6, 11` (우상단, 텍스트와 겹침) | `NODE_W-4, -6` (노드 위쪽 바깥) |

아이콘이 노드 상단 바깥으로 돌출되어 다른 텍스트와 겹치지 않음

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | CSS 애니메이션 수정, overlay rect 분리, ⚠ 아이콘 크기/위치 조정 |

