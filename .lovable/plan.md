

# CPM 네트워크 노드 경고 시각화 시스템 (수정)

## 개요

진도/일정 데이터와 네트워크 구조 데이터로 5가지 경고를 노드에 직접 시각화합니다. 변경 파일: `public/cpm_network.html` 단일 파일.

## 경고 유형 및 판별 기준

| 경고 | 조건 | 시각화 |
|------|------|--------|
| **진도 지연** | actual < planned - 10% | 노드 **우측 상단**에 주황 `▲` |
| **심각 지연** | actual < planned - 25% | 노드 **우측 상단**에 빨간 `▲▲` + 테두리 점멸 |
| **일정 초과** | overdueDays > 0 | 기존 `⚠ +Nd` 유지 |
| **CP 지연** | CP 노드 + actual < planned - 5% | 노드 **우측 상단**에 🔥 + 테두리 점멸 |
| **여유시간 소진** | TF ≤ 0, 비CP | 주황 점선 테두리 + TF 빨간 표시 |
| **선행 지연 전파** | predecessor 지연 10%+ | 연결선 주황 + 노드 **우측 상단**에 🔗 |

## 변경 내용

### 1. CSS — 점멸 애니메이션
```css
@keyframes alertBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.node-alert-blink { animation: alertBlink 1.2s ease-in-out infinite; }
```

### 2. `drawNetwork()` — 경고 판별 로직

기존 `statusData` 조회 이후 `gap`, `isSevereDelay`, `isModerateDelay`, `isCpDelay`, `isFloatExhausted`, `hasPredDelay` 계산. 이전 계획과 동일한 로직.

### 3. 경고 아이콘 위치 — **노드 우측 상단**

```javascript
// 아이콘을 노드 우측 상단에 배치
let alertIcon = '';
const iconX = NODE_W - 14;  // 우측 여백
const iconY = 12;            // 상단 여백

if (isSevereDelay) alertIcon = `<text x="${iconX}" y="${iconY}" font-size="9" fill="#ff4d4d" text-anchor="end" font-weight="700">▲▲</text>`;
else if (isModerateDelay) alertIcon = `<text x="${iconX}" y="${iconY}" font-size="9" fill="#ff9800" text-anchor="end" font-weight="700">▲</text>`;

if (isCpDelay) alertIcon += `<text x="${iconX - 16}" y="${iconY}" font-size="9" fill="#ff4d4d" text-anchor="end">🔥</text>`;

if (hasPredDelay && !isSevereDelay && !isModerateDelay) {
  alertIcon += `<text x="${iconX}" y="${iconY}" font-size="9" fill="#ff9800" text-anchor="end">🔗</text>`;
}
```

### 4. 노드 테두리 동적 변경

- **critical** (심각지연/CP지연): `stroke='#ff4d4d'`, `strokeW=2.5`, class `node-alert-blink`
- **warning** (보통지연/여유시간소진): `stroke='#ff9800'`, `strokeW=2`, `stroke-dasharray="4,2"`
- **info** (선행지연전파): 기존 색상 유지, 연결선만 주황

### 5. 연결선 — 선행 지연 전파

predecessor가 10%+ 지연이면 edge 색상을 `#ff9800`으로 변경.

### 6. 여유시간(TF) 강조

`a.tf <= 0`이면 TF 텍스트를 `#ff4d4d`로 변경.

### 7. 사이드바 경고 요약 바

필터 뱃지 아래에 `[● 3] [● 7] [● 12]` 형태로 critical/warning/info 카운트 표시. `drawNetwork()` 완료 후 집계.

## 기대 결과

- 경고 아이콘이 노드 **우측 상단**에 표시되어 기존 노드명/WBS 정보와 겹치지 않음
- critical 노드는 빨간 점멸 테두리로 즉시 식별
- 사이드바 요약으로 전체 경고 현황 한눈에 파악

