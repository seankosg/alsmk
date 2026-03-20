

## Workspace — Project Task 탭 추가 (읽기전용)

### 변경 내용

**1. `src/pages/Workspace.tsx`**
- `filterMode` 타입을 `"mine" | "team" | "project"`로 확장
- `showTabs` 조건 변경: 모든 비-admin/비-PM 사용자에게 3개 탭 표시
- TabsTrigger 추가: `"project"` → "프로젝트 태스크"

**2. `src/components/tasks/TaskTable.tsx`**
- `filterMode` 타입에 `"project"` 추가
- `filterMode === "project"` 일 때 필터링 없이 전체 태스크 표시
- `filterMode === "project"` 일 때 **읽기전용 모드** 적용:
  - 진도율 인라인 편집 비활성화 (클릭 이벤트 무시)
  - TaskDetailDialog를 열되, 수정 불가 상태로 표시 (또는 열기만 허용)

### 읽기전용 처리
- `readOnly` 플래그를 `filterMode === "project"` 조건으로 파생
- 진도율 셀 클릭 시 편집 모드 진입 차단
- 행 클릭으로 상세보기는 가능 (정보 확인 목적)

### 수정 범위
- `Workspace.tsx`: 탭 1개 추가 (~5줄)
- `TaskTable.tsx`: filterMode 타입 확장 + 필터 분기 + readOnly 처리 (~15줄)

