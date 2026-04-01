

# CPM 매핑 변경 계획 전체 요약

승인된 2개 계획을 정리합니다.

---

## 계획 1: MapTasksDialog — Summary 기반 그룹 매핑

**현재 문제**: Subtask가 모두 개별 노출되어 매핑이 번거로움 (`is_summary = false` 필터로 Summary 제외, Subtask만 표시)

**변경 내용** (`src/components/cpm/MapTasksDialog.tsx`):

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 표시 목록 | `is_summary=false`인 태스크만 | `parent_id`가 없는 것만 (Summary + 단독 Task) |
| Summary 표시 | 미표시 | Badge + 하위 태스크 수 표시 |
| 저장 로직 | 선택된 ID 그대로 저장 | Summary 선택 시 하위 Subtask ID들로 확장(expand)하여 저장 |
| 기존 매핑 로드 | task_id 직접 매칭 | Subtask가 매핑되어 있으면 parent Summary를 선택 상태로 역매핑 |

**핵심 로직**:
- 표시: `allTasks.filter(t => !t.parent_id)` — Summary + 단독 Task만
- 저장: Summary ID → `childrenMap.get(id).map(c => c.id)`로 확장
- 로드: 매핑된 subtask의 `parent_id`를 찾아 Summary 선택 상태 복원

---

## 계획 2: TaskTable — CPM 매핑 아이콘을 Summary에도 표시

**현재 문제**: `cpm_task_mappings`에는 subtask ID만 저장되므로 Summary에는 매핑 아이콘이 표시되지 않음

**변경 내용** (`src/components/tasks/TaskTable.tsx`):

- `useMemo`로 확장 Set 생성: 매핑된 subtask의 `parent_id`(Summary ID)도 포함
- 아이콘 조건을 `cpmMappedTaskIds?.has(task.id)` → `cpmDisplayIds.has(task.id)`로 변경
- Summary + Subtask 모두 아이콘 표시

---

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `src/components/cpm/MapTasksDialog.tsx` | 쿼리 필터 변경, Summary Badge, 저장 시 expand, 로드 시 역매핑 |
| `src/components/tasks/TaskTable.tsx` | `useMemo` 확장 Set으로 Summary에도 매핑 아이콘 표시 |

