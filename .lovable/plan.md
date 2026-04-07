

# 비매핑 노드에 지연 일수 표시

## 개요
현재 비매핑 + 기한초과 노드는 ⚠ 아이콘만 표시되고 지연 일수가 없음. 매핑된 노드의 `⚠ +Nd` 표시와 동일하게 비매핑 노드에도 지연 일수를 표시.

## 변경 사항 (`public/cpm_network.html`)

### 1. Alert 캐시에 지연 일수 저장 (line 1298-1304)
```javascript
// 기존: unmappedOverdue: boolean만 저장
// 변경: unmappedOverdueDays 일수도 계산하여 저장
const unmappedOverdueDays = isUnmappedOverdue
  ? Math.round((_todayAlert - new Date(a.finishDate)) / 86400000)
  : 0;
_alertCache[id] = { gap, hasStatus: hasMappedStatus, unmappedOverdue: !!isUnmappedOverdue, unmappedOverdueDays };
```

### 2. ⚠ 아이콘 옆에 일수 표시 (line 1466-1468)
```javascript
// 기존: ⚠ 아이콘만
// 변경: ⚠ +Nd 형태로 일수 포함
if (isUnmappedOverdue && !isSevereDelay && !isCpDelay) {
  const uDays = alertInfo.unmappedOverdueDays || 0;
  alertIcon += `<text x="${iconX}" y="${iconY}" font-size="13" fill="#ff4d4d" text-anchor="end">⚠</text>`;
  if (uDays > 0) {
    alertIcon += `<text x="${iconX + 2}" y="${iconY}" font-family="var(--mono)" font-size="9" fill="#ff4d4d" text-anchor="start" font-weight="600">+${uDays}d</text>`;
  }
  needsBlinkOverlay = true;
}
```

### 3. 노드 바디 영역에도 비매핑 overdue 일수 표시 (line 1555-1562)
기존 `statusData.overdue` 체크에 비매핑 케이스 추가:
```javascript
${(() => {
  // Mapped overdue
  const overdueData = statusData && statusData.overdue;
  const overdueDays = statusData && statusData.overdueDays;
  if (overdueData && overdueDays > 0) {
    return `<text ...>⚠ +${overdueDays}d</text>`;
  }
  // Unmapped overdue
  const uDays = alertInfo.unmappedOverdueDays || 0;
  if (isUnmappedOverdue && uDays > 0) {
    return `<text ...>⚠ +${uDays}d</text>`;
  }
  return '';
})()}
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | alert 캐시에 일수 저장 + 아이콘/바디에 일수 표시 (3곳) |

