

## 요약

Task 입력/수정 시 Category 필드를 기존 **텍스트 입력(Input)**에서 **콤보박스(Combobox)** 형태로 변경합니다. 기존에 DB에 저장된 category 값 목록을 드롭다운으로 보여주고, 목록에서 선택하거나 직접 새 값을 입력할 수 있도록 합니다.

## 변경 대상 파일 (3개)

### 1. 새 컴포넌트: `src/components/tasks/CategoryCombobox.tsx`
- DB의 `tasks` 테이블에서 고유한 category 값 목록을 조회 (`SELECT DISTINCT category FROM tasks WHERE category IS NOT NULL`)
- shadcn/ui의 `Popover` + `Command` 컴포넌트를 활용한 콤보박스 구현
- 기존 값 선택 또는 새 값 직접 입력 가능
- Props: `value`, `onChange`

### 2. `src/components/tasks/AddTaskDialog.tsx`
- Category 필드의 `<Input>`을 `<CategoryCombobox>`로 교체

### 3. `src/components/tasks/TaskDetailDialog.tsx`
- Category 필드의 `<Input>`을 `<CategoryCombobox>`로 교체

### 4. `src/components/tasks/AddSubtaskDialog.tsx`
- Category 필드의 `<Input>`을 `<CategoryCombobox>`로 교체

## 동작 방식
- 클릭하면 기존 category 목록이 드롭다운으로 표시
- 검색/필터 입력 가능
- 목록에 없는 값은 직접 타이핑하여 새로 추가 가능
- 선택 또는 입력 후 값이 category state에 반영

