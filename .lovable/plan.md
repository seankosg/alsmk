

# CPM BLDG 커스텀 필드 표시

3곳에 BLDG 값을 표시합니다.

## 1. 사이드바 Activity 카드 (`public/cpm_network.html`, ~line 581-611)

card-row1의 WBS 뒤, 이름 앞에 BLDG 배지 추가:

```text
<span class="act-id">#123</span>
<span>WBS 1.1</span>
${a.customFields?.BLDG ? `<span style="font-size:10px;color:#c97a10;...">${a.customFields.BLDG}</span>` : ''}
<input class="act-name-input" ...>
```

최우측에 위치시키기 위해 WBS 뒤에 삽입하되 주황/골드 계열 색상으로 차별화합니다.

## 2. 네트워크 노드 상단 (~line 1133-1136)

노드 상단 행: 좌측 `displayId`, 우측 `displayWbs` 사이에 BLDG를 WBS 왼쪽에 표시:

```text
변경 전: <text x="${NODE_W-8}" ... text-anchor="end">${displayWbs}</text>
변경 후:
  // BLDG를 WBS 왼쪽에 표시
  ${bldgVal ? `<text x="${NODE_W-8-wbsWidth-4}" ... text-anchor="end" fill="#c97a10">${bldgVal}</text>` : ''}
  <text x="${NODE_W-8}" ... text-anchor="end">${displayWbs}</text>
```

또는 더 간단하게, WBS 오른쪽 최상단에 BLDG를 추가:
- `displayWbs` 텍스트 끝에 BLDG 값을 골드색으로 표시
- 변수: `const bldgVal = (a.customFields && a.customFields.BLDG) || '';`

## 3. 상세 패널 WBS 배지 옆 (`ActivityTaskPanel.tsx`, ~line 196-202)

WBS Badge 바로 다음에 BLDG Badge 추가:

```tsx
{activity.wbsFull && (
  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
    {activity.wbsFull}
  </Badge>
)}
{activity.customFields?.BLDG && (
  <Badge variant="outline" className="font-mono text-xs text-amber-500 border-amber-500/30">
    {activity.customFields.BLDG}
  </Badge>
)}
```

## 변경 파일

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | 사이드바 카드 row1에 BLDG 표시, 네트워크 노드 상단에 BLDG 표시 |
| `src/components/cpm/ActivityTaskPanel.tsx` | WBS 배지 옆에 BLDG 배지 추가 |

