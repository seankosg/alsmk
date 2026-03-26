

# CPM 매핑 태스크 표시 제안

## 표시 위치: Task Code 컬럼 옆 아이콘

**추천 방식**: Task Code 셀에 작은 네트워크 아이콘(🔗 또는 Lucide `Network` 아이콘)을 표시합니다.

```text
현재:   CON-STL-2506-0001
변경후: CON-STL-2506-0001  🔗
```

- CPM에 매핑된 태스크만 아이콘 표시
- 아이콘에 마우스를 올리면 Tooltip으로 매핑된 Activity 이름 표시
- 아이콘 색상: `text-info` (파란색) — 기존 코멘트 아이콘과 통일된 스타일

## 구현 방법

### 1. `src/components/tasks/TaskTable.tsx`

**데이터 조회 추가**: `cpm_task_mappings` 테이블에서 매핑된 task_id 목록을 조회
```typescript
const { data: cpmMappedTaskIds = [] } = useQuery({
  queryKey: ["cpm_mapped_task_ids"],
  queryFn: async () => {
    const { data } = await supabase
      .from("cpm_task_mappings")
      .select("task_id");
    return [...new Set(data?.map(d => d.task_id) ?? [])];
  },
  staleTime: 30_000,
});
```

**Task Code 셀에 아이콘 추가** (line 480 부근):
```text
CON-STL-2506-0001  [Network 아이콘 + Tooltip "CPM Activity에 매핑됨"]
```

- `cpmMappedTaskIds` Set에 `task.id`가 포함되어 있으면 Lucide `Network` 아이콘 표시
- Tooltip에 "CPM 매핑됨" 텍스트 표시

### 변경 파일
| 파일 | 변경 |
|------|------|
| `TaskTable.tsx` | cpm_task_mappings 조회 + Task Code 셀에 매핑 아이콘 추가 |

