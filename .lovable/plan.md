

# CPM 저장/불러오기 통합 구현

## 변경 사항

### 1. `public/cpm_network.html` — 프로젝트 버튼/패널 제거 + postSnapshotSave 단순화

**HTML 제거:**
- Lines 515-522: `📁 프로젝트` 버튼 제거
- Lines 596-610: `projOverlay` + `projPanel` HTML 전체 제거
- Lines 493-497: `saveIndicator` 스팬 제거 (프로젝트 기능과만 연결됨)

**CSS 제거:**
- Lines 411-478: `.proj-panel`, `.proj-overlay`, `.proj-item` 등 모든 프로젝트 관련 스타일 제거

**JS 제거:**
- Lines 2585-2746: `PROJ_PREFIX`, `_currentProjKey`, `toggleProjPanel`, `saveProject`, `loadProject`, `deleteProject`, `renameProject`, `getAllProjKeys`, `renderProjList`, `_makeSnapshot`, `_restoreSnapshot` 전체 제거
  - 단, `_makeSnapshot`과 `_restoreSnapshot`은 DB 스냅샷 복원에도 사용되므로 **유지**

**JS 수정:**
- `postSnapshotSave()` (line 2864-2872): `_currentProjKey` 참조 제거, 항상 `name: "auto"` 사용
- `saveToStorage()` (lines 2773-2783): `_currentProjKey` 참조하는 saveIndicator 로직 제거
- `loadProject` 호출부가 있는 snapshot-restore 핸들러에서 `_currentProjKey` 참조 제거

### 2. `src/components/cpm/SnapshotManager.tsx` — "auto" 스냅샷 라벨 구분

- 스냅샷 목록에서 `name === "auto"`인 항목에 "(자동저장)" 부가 라벨 표시
- 자동저장 스냅샷은 시각적으로 구분 (예: 이름 옆에 작은 뱃지)

## 수정 파일

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | 프로젝트 버튼, 패널, 오버레이, CSS, JS 함수 제거; `postSnapshotSave` 단순화 |
| `src/components/cpm/SnapshotManager.tsx` | "auto" 스냅샷에 "(자동저장)" 라벨 추가 |

## 기술 세부사항

**유지되는 기능:**
- `_makeSnapshot()` / `_restoreSnapshot()`: DB 스냅샷 저장/복원에 필요하므로 유지
- `saveToStorage()` / `loadFromStorage()`: localStorage 캐시로 유지 (빠른 복원용)
- `postSnapshotSave()`: 계산 시 자동으로 DB에 "auto" 이름으로 저장
- `snapshot-restore` 메시지 핸들러: React에서 DB 스냅샷 복원 시 사용

**`postSnapshotSave` 변경 후:**
```js
function postSnapshotSave() {
  if (window.parent === window) return;
  if (!calculated || activities.length === 0) return;
  const snapshot = _makeSnapshot('auto');
  window.parent.postMessage({ type: 'snapshot-save', snapshot }, '*');
}
```

