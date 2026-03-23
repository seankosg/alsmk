

# CPM Manager UI 변경 계획 (수정)

## 변경 1: 사이드바 이름 및 위치 변경

**파일**: `src/components/layout/AppSidebar.tsx`

- `title`을 `"CPM Manager"`로 변경
- navItems 순서를 My Workspace → **CPM Manager** → Messages 순으로 재배치

## 변경 2: 스냅샷 저장을 Admin 전용으로 제한

**파일**: `src/components/cpm/SnapshotManager.tsx`

- `useAuthContext()`로 `isAdmin` 확인
- 저장 입력 영역 + 삭제 버튼을 Admin에게만 렌더링
- 비-Admin은 목록 조회 및 불러오기만 가능

## 변경 3: 왼쪽 사이드패널의 Activity 추가 버튼 숨기기

**파일**: `public/cpm_network.html`

- 538행의 `<button class="btn-add" onclick="addActivity()">+ 추가</button>` 를 `display:none` 또는 제거
- 사이드패널의 각 Activity 카드 내 삭제 버튼(`×`)도 이미 이전 계획에서 readonly 처리 예정이므로, 추가 버튼만 숨기면 사이드패널은 조회 전용이 됨

### 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `src/components/layout/AppSidebar.tsx` | 이름 변경 + 순서 재배치 |
| `src/components/cpm/SnapshotManager.tsx` | Admin 전용 저장/삭제 |
| `public/cpm_network.html` | `+ 추가` 버튼 숨김 |

