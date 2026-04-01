

# MPP 진도율 지연 시 Overdue 노드 빨간 깜박임 추가

## 현재 상태
- `_alertCache`는 매핑된 태스크가 있는 경우(`hasStatus: true`)에만 gap을 계산
- 매핑 없는 activity는 `gap: 0, hasStatus: false` → 경고 없음
- 따라서 MPP 진도율만으로는 지연 감지 불가

## 변경: `public/cpm_network.html`

### 1. `_alertCache` 계산 확장 (lines 1230-1239)

매핑 없는 activity에 대해 MPP overdue 감지 추가:

```javascript
// 기존: hasMappedStatus만 체크
// 변경: 매핑 없을 때 finish_date < today && progress < 100 → overdue로 판정
const today = new Date(); today.setHours(0,0,0,0);
const isUnmappedOverdue = !hasMappedStatus 
  && a.finishDate 
  && new Date(a.finishDate) < today 
  && (a.progress === null || a.progress === undefined || a.progress < 100);

_alertCache[id] = { 
  gap, hasStatus: hasMappedStatus, 
  unmappedOverdue: isUnmappedOverdue 
};
```

### 2. Alert Detection 로직 확장 (lines 1331-1353)

`unmappedOverdue`를 critical alert로 처리:

```javascript
const isUnmappedOverdue = alertInfo.unmappedOverdue;
// 기존 조건에 추가
if (isSevereDelay || isCpDelay || isUnmappedOverdue) { 
  alertLevel = 'critical'; ... 
}
```

→ 빨간 테두리 + `node-alert-blink` 애니메이션 자동 적용

### 3. Alert 아이콘 추가 (lines 1364-1379)

unmappedOverdue인 경우 `⚠` 아이콘 표시

## 결과
- 매핑 태스크 없음 + finish_date가 오늘 이전 + MPP 진도 < 100% → 빨간 깜박임 테두리
- 기존 매핑 기반 경고 로직은 변경 없음

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | `_alertCache`에 unmappedOverdue 추가, alert 판정 조건 확장 |

