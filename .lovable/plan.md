

# Fix: CPM ActivityTaskPanel Subject 그룹핑

## 문제 원인

매핑된 태스크는 모두 subtask (`is_summary=false`, `parent_id`가 있음). 현재 코드는 `task.title` (subtask 자체의 제목)로 그룹핑하고 있으나, 사용자가 기대하는 "Subject"는 **부모 summary task의 title**입니다.

Workspace에서는 summary task가 Subject 그룹 헤더 역할을 하고, 그 아래 subtask들이 나열되는 구조입니다.

## 수정 내용: `src/components/cpm/ActivityTaskPanel.tsx`

### 1. 데이터 조회에 `parent_id` 추가
- tasks SELECT에 `parent_id` 필드 추가
- `TaskWithMember` 인터페이스에 `parent_id`, `parent_title` 추가

### 2. 부모 summary task title 조회
- 매핑된 태스크들의 `parent_id`를 수집
- 부모 summary task들을 별도 조회하여 `{ parent_id → parent.title }` 맵 생성
- 각 태스크에 `parent_title` 할당 (parent가 없으면 자신의 title 사용)

### 3. 그룹핑 키 변경
```text
변경 전: t.title (subtask 자체 제목)
변경 후: t.parent_title (부모 summary task 제목, 없으면 자체 제목)
```

### 4. Task 행 표시는 현재와 동일 유지
```text
[X] [task_code] [action_plan] [progress] [gap]
```

### 5. HoverCard에 Subject(parent_title)도 표시

