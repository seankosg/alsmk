

# Overdue/Critical 필터: 해당 노드만 표시하도록 수정

## 현재 문제

1. **필터 조건 불완전**: `isUnmappedOverdue`만 체크 → 빨간 글로우로 깜박이는 `isSevereDelay`, `isCpDelay` 노드가 누락됨
2. **비관련 노드 표시**: 선행/후행(predecessor/successor) 컨텍스트 노드까지 포함하여 필터 의미가 희석됨

## 수정: `public/cpm_network.html`

### 1. 필터 조건을 critical 전체로 확장 (line 1136~1163)

```javascript
// 현재: isUnmappedOverdue만 + 선행/후행 포함
if (isUnmappedOverdue) overdueIds.add(id);
// + predecessor/successor context 추가 로직

// 수정: alertLevel === 'critical'인 모든 노드 (깜박이는 노드 전체)
const _tSeverePre = window._alertThresholds?.severe ?? 10;
const _tCpPre = window._alertThresholds?.cpDelay ?? 5;
const gap = ...; // planned - actual
const isSevereDelayPre = hasMappedStatus && gap >= _tSeverePre;
const isCpDelayPre = a.isCritical && hasMappedStatus && gap >= _tCpPre;
if (isUnmappedOverdue || isSevereDelayPre || isCpDelayPre) overdueIds.add(id);
```

### 2. 컨텍스트 노드 제거

선행/후행 노드를 추가하는 로직(line 1150~1163)을 삭제하여, **깜박이는 노드만** 표시:

```javascript
// 삭제: contextIds 관련 코드 전체
// visibleSet = overdueIds; (직접 사용)
visibleSet = overdueIds;
```

### 3. 버튼 라벨 업데이트

"⚠ Overdue" → "⚠ Critical"로 변경하여 필터 범위를 정확히 반영

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | 필터 조건 확장 + 컨텍스트 노드 제거 + 라벨 수정 |

