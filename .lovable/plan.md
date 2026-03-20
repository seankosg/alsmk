

## Task 정렬 필터 — 다중선택 및 우선순위 설정

### 현재 상태
- 단일 컬럼 정렬만 지원 (클릭 시 asc/desc 토글, 다른 컬럼 클릭 시 기존 정렬 해제)
- `sortKey` (string | null) + `sortDir` ("asc" | "desc") 상태 사용

### 변경 내용

**파일**: `src/components/tasks/TaskTable.tsx`

1. **다중 정렬 상태 구조 변경**
   - `sortKey`/`sortDir` → `sortColumns: Array<{ key: string; dir: "asc" | "desc" }>` 배열로 교체
   - 배열 순서 = 정렬 우선순위 (index 0이 1차 정렬)

2. **컬럼 헤더 클릭 동작**
   - **일반 클릭**: 해당 컬럼만으로 단일 정렬 (기존과 동일한 UX)
   - **Shift+클릭**: 다중 정렬에 컬럼 추가 (이미 있으면 방향 토글, 3번째 클릭 시 해당 컬럼 제거)

3. **우선순위 표시 UI**
   - 다중 정렬 활성 시 각 컬럼 헤더에 우선순위 번호 표시 (①②③ 등)
   - 방향 화살표(↑↓)와 함께 작은 뱃지로 표시

4. **정렬 초기화**
   - 헤더 영역에 "Clear Sort" 버튼 추가 (다중 정렬 활성 시에만 표시)

5. **compareFn 수정**
   - `sortColumns` 배열을 순회하며 다단계 비교 로직 적용
   - 1차 정렬이 동일하면 2차, 2차도 동일하면 3차로 진행

### UI 예시
```text
컬럼 헤더:
[Task Code ↑ ①] [Category] [Subject ↓ ②] [Start ↑ ③] ...

Shift+클릭으로 다중 정렬 추가
일반 클릭으로 단일 정렬 복귀
```

### 수정 범위
- `TaskTable.tsx`만 수정 (약 40줄 변경)
- 상태 변수 교체, handleSort 로직 변경, compareFn 수정, 헤더 UI 뱃지 추가

