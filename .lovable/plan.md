

# 좌측 사이드바 선행/후행 #mppTaskId 표시 수정

## 현재 상태

- **우측 React 패널**: ✅ 선행/후행 모두 `#mppTaskId`로 정상 표시
- **네트워크 툴팁**: ✅ 선행은 `#mppTaskId`, 후행은 미표시
- **좌측 iframe 사이드바 카드**: ❌ `a.predecessors` 원시 문자열(`A244,A250`) 그대로 표시

## 수정: `public/cpm_network.html`

### 1. 선행작업 input (line 766)
`a.predecessors` 대신 `predLinks`를 파싱하여 `#mppTaskId + 이름` 형태로 변환:

```javascript
// 변경 전
value="${(a.predecessors||'')}"

// 변경 후: predLinks 파싱 → #mppTaskId 이름 형식
value="${(() => {
  const raw = (a.predLinks&&a.predLinks.trim())?a.predLinks:(a.predecessors||'');
  const map = {}; activities.forEach(x=>map[x.id]=x);
  return raw.split(',').map(s=>s.trim().split(':')[0].trim())
    .filter(s=>s&&map[s])
    .map(pid=>{const p=map[pid]; return (p.mppTaskId?'#'+p.mppTaskId:pid)+' '+p.name;})
    .join(', ') || '-';
})()}"
```

### 2. 후행작업 input (line 772)
현재 `a.successors`가 비어있거나 A-ID만 있으므로, 동적으로 후행을 계산:

```javascript
// 변경 후: 실시간 successor 계산 → #mppTaskId 이름 형식
value="${(() => {
  const map = {}; activities.forEach(x=>map[x.id]=x);
  return activities.filter(o=>o.id!==a.id).filter(o=>{
    const ps=(o.predLinks&&o.predLinks.trim())?o.predLinks:(o.predecessors||'');
    return ps.split(',').map(s=>s.trim().split(':')[0].trim()).includes(a.id);
  }).map(o=>(o.mppTaskId?'#'+o.mppTaskId:o.id)+' '+o.name).join(', ') || '-';
})()}"
```

### 3. 툴팁에 후행 추가 (line 2081~2084)
기존 선행 표시 아래에 후행 정보도 추가

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | 좌측 사이드바 카드의 선행/후행을 #mppTaskId로 변환 + 툴팁에 후행 추가 |

