

## 요약

서머리 태스크에 서브태스크 추가 후, 해당 그룹의 모든 서브태스크 코드(`task_code`)를 **시작날짜(start_date)** 기준으로 재정렬하는 기능을 구현합니다.

현재 "Add Subtask" 버튼은 서머리 태스크에도 이미 표시되고 동작합니다. 핵심 변경은 **서브태스크 추가 후 코드 재정렬** 로직입니다.

## 변경 파일

### `src/components/tasks/AddSubtaskDialog.tsx`

서브태스크 삽입 후 다음 로직 추가:

1. 해당 parent의 모든 서브태스크를 조회
2. `start_date` 오름차순으로 정렬
3. 각 서브태스크의 `task_code`를 `{parent_code}-01`, `{parent_code}-02`, ... 순서로 업데이트

이 로직은 **기존 single→summary 변환 시**와 **이미 summary인 경우** 모두에 적용됩니다.

```text
[서브태스크 insert 완료]
       ↓
[parent의 모든 서브태스크 SELECT, ORDER BY start_date ASC]
       ↓
[각 서브태스크 task_code = parent_code + "-" + 순번(01, 02, ...)]
```

## 기술 상세

`handleSave` 함수의 insert 성공 후:

```typescript
// 3. Re-order all sibling subtasks by start_date
const { data: siblings } = await supabase
  .from("tasks")
  .select("id, start_date, task_code")
  .eq("parent_id", parent.id)
  .order("start_date", { ascending: true })
  .order("created_at", { ascending: true });

if (siblings && siblings.length > 0) {
  const parentTask = await supabase
    .from("tasks")
    .select("task_code")
    .eq("id", parent.id)
    .single();
  const parentCode = parentTask.data?.task_code;
  if (parentCode) {
    for (let i = 0; i < siblings.length; i++) {
      const newCode = parentCode + "-" + String(i + 1).padStart(2, "0");
      if (siblings[i].task_code !== newCode) {
        await supabase.from("tasks")
          .update({ task_code: newCode })
          .eq("id", siblings[i].id);
      }
    }
  }
}
```

이 변경으로 서브태스크 추가 시마다 기존+신규 서브태스크가 시작날짜 순서로 코드가 재배정됩니다.

