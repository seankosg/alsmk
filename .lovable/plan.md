

# 사이드바 Activity 카드 수정/삭제 비활성화

## 변경 내용

### `public/cpm_network.html` — `renderSidebar()` (663행대)

현재 각 카드에는:
- 이름 input (`act-name-input`) — 편집 가능
- 기간 input — 편집 가능
- 선행작업 input — 편집 가능
- WBS input — 편집 가능
- 삭제 버튼 (`btn-del`, `×`) — 클릭 가능

**수정:**
1. 삭제 버튼 (`×`) 제거 또는 `display:none` 처리
2. 모든 input에 `readonly` 속성 추가 (이름, 기간, 선행작업, WBS)
3. readonly input 스타일: 커서/배경을 비활성화 느낌으로 변경 (예: `cursor:default; opacity:0.8`)

이렇게 하면 카드는 정보 표시 전용이 되고, Activity 데이터는 XML import를 통해서만 변경됩니다.

### 변경 파일
| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | renderSidebar 내 input readonly + 삭제버튼 제거 |

