

# CPM 네트워크 노드 색상 계획 제안

## 현재 색상 체계 (기존)

```text
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│ 구분              │ fill (배경)   │ stroke (테두리)│ header bar   │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 일반 노드         │ #131b2a      │ #2a3347      │ #4da6ff      │
│ 크리티컬 패스      │ #1f1010      │ #ff4d4d      │ #ff4d4d      │
│ 패스스루(필터 외 CP)│ #1a1200      │ #c97a10      │ #c97a10      │
└──────────────────┴──────────────┴──────────────┴──────────────┘
```

## 제안: Text1 기반 5단계 노드 색상 체계

전체 보기(필터 미적용) 시 노드를 **역할별로 구분**합니다.

```text
┌────────┬──────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Text1  │ 의미          │ fill (배경)       │ stroke (테두리)   │ header bar       │
├────────┼──────────────┼──────────────────┼──────────────────┼──────────────────┤
│ KUKU   │ 건축 (당사)    │ #0f1f2e (진한청)  │ #3b82f6 (파랑)    │ #3b82f6          │
│ 선행*  │ KUKU 선행작업  │ #1a1a0f (진한황)  │ #eab308 (노랑)    │ #eab308          │
│ HS     │ 발주처         │ #1a1a1a (어두움)  │ #555 (회색)       │ #888             │
│ TOMO   │ 토목          │ #1a1a1a          │ #555             │ #888             │
│ PLNT   │ 플랜트        │ #1a1a1a          │ #555             │ #888             │
│ MS     │ 마일스톤       │ #1a1a1a          │ #555             │ #888             │
│ CP노드 │ 크리티컬 패스   │ (위 배경 유지)    │ #ff4d4d (빨강)    │ #ff4d4d          │
└────────┴──────────────┴──────────────────┴──────────────────┴──────────────────┘

* "선행" = KUKU가 아니지만, KUKU Activity의 직접 선행작업(predecessor)인 Activity
```

### 핵심 설계 원칙

1. **KUKU = 파란색 강조** — 당 사업본부 Activity가 시각적으로 즉시 구분됨
2. **KUKU 선행작업 = 노란색** — 타 파티지만 KUKU에 직접 영향을 주는 Activity를 별도 강조
3. **나머지 타 파티 = 어둡고 흐림** — opacity 0.5 적용하여 배경처럼 보이도록
4. **크리티컬 패스 = 빨간 테두리/헤더 오버레이** — 필터 무관하게 항상 CP 노드는 빨간 테두리 유지 (fill은 역할별 색상 유지)

### CP와 역할 색상의 조합 규칙

```text
if (isCritical) {
  stroke = '#ff4d4d'    // CP 빨강 항상 우선
  strokeWidth = 2.5
  headerBar = '#ff4d4d'
  fill = 역할별 배경색 유지
} else if (isKuku) {
  fill/stroke/header = 파랑 계열
} else if (isKukuPredecessor) {
  fill/stroke/header = 노랑 계열
} else {
  fill/stroke/header = 회색 (+ opacity 0.5)
}
```

### "KUKU 선행작업" 판별 로직

```javascript
// predLinkMap에서 KUKU Activity의 predecessor 중 KUKU가 아닌 것을 수집
const kukuPredecessorIds = new Set();
activities.forEach(a => {
  const text1 = a.customFields?.Text1 || a.customFields?.['텍스트1'] || '';
  if (text1 === 'KUKU') {
    predLinkMap[a.id]?.forEach(p => {
      const pred = map[p.id];
      const predText1 = pred?.customFields?.Text1 || pred?.customFields?.['텍스트1'] || '';
      if (predText1 !== 'KUKU') kukuPredecessorIds.add(p.id);
    });
  }
});
```

## 구현 범위

- **변경 파일**: `public/cpm_network.html` (단일 파일)
- **변경 위치**: `drawNetwork` 함수 내 노드 색상 결정 로직 (line ~1101-1108)
- **추가**: KUKU predecessor Set 계산 로직 (drawNetwork 진입부)
- **추가**: 타 파티 노드 SVG 그룹에 `opacity="0.5"` 적용

## 시각적 결과 요약

```text
전체 보기:
  ■ 파랑  = KUKU (건축, 당사 관리 대상)
  ■ 노랑  = KUKU 선행 (타 파티지만 모니터링 필요)
  □ 흐림  = 나머지 타 파티 (배경 수준)
  ▬ 빨강  = 크리티컬 패스 (테두리/헤더, 모든 역할에 오버레이)
```

