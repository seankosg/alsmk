

# 지연 선행 → KUKU 노드 연결선 붉은색 글로우 점멸

## 변경 파일: `public/cpm_network.html`

### 1. CSS 추가 (line 45 근처)
```css
@keyframes edgeAlertBlink {
  0%,100% { stroke-opacity:1; filter: drop-shadow(0 0 8px #ff4d4d) drop-shadow(0 0 3px #ff0000); }
  50% { stroke-opacity:0.3; filter: drop-shadow(0 0 2px #ff4d4d); }
}
.edge-alert-blink { animation: edgeAlertBlink 1.2s ease-in-out infinite; }
```

### 2. 붉은 화살촉 마커 추가 (SVG defs 영역)
기존 `arr-crit`, `arr-norm` 마커 옆에 `arr-blink` 마커 추가 (fill: `#ff4d4d`)

### 3. 연결선 렌더링 수정 (lines 1304-1331)

기존 edge 색상 결정 로직에 조건 추가:

```text
기존:  isCrit → 빨간 / predDelayed → 주황 / 기본 → 회색
추가:  선행이 needsBlinkOverlay 대상 + 후행이 KUKU → 글로우 점멸
```

구체적으로:
- 후행 노드(`id`)가 `kukuIds`에 포함되는지 확인
- 선행 노드(`pid`)가 critical alert 상태인지 확인 (`_alertCache`에서 `gap >= _tSevere` 또는 `unmappedOverdue` 또는 CP 지연)
- 두 조건 모두 충족 시: `color = '#ff4d4d'`, `strokeW = 3`, `class="edge-alert-blink"` 적용, 실선(dasharray 제거), `marker-end="url(#arr-blink)"`

이미 `kukuIds` Set이 line 1221에서 계산되어 있으므로 바로 활용 가능.

## 결과
- critical alert으로 깜빡이는 선행 노드에서 KUKU 노드로 향하는 연결선이 동일 리듬의 붉은 글로우로 점멸
- 어떤 KUKU 작업이 선행 지연의 영향을 받는지 시각적으로 즉시 파악 가능

