

# ActivityTaskPanel 표시 변경: Subject 그룹 + Action Plan 행

## 변경 파일: `src/components/cpm/ActivityTaskPanel.tsx`

### 1. 데이터 조회 변경
- tasks SELECT에 `action_plan` 필드 추가

### 2. TaskWithMember 인터페이스
- `action_plan: string | null` 추가

### 3. 그룹핑 변경
- `team_id` 기준 → `title` (Subject) 기준으로 변경
- 각 그룹 내 tasks를 `task_code` 순으로 정렬
- title이 null이면 "미분류"로 표시

### 4. 그룹 헤더 행
- 팀 이름 대신 Subject (`task.title`) 표시
- 진행률 바, GAP 등 요약 통계는 동일하게 유지

### 5. Task 행 표시
```text
변경 전: [X] [task_code] [title]        [actual/planned%] [gap]
변경 후: [X] [task_code] [action_plan]   [actual/planned%] [gap]
```
- `action_plan`이 null이면 "-" 표시

### 6. HoverCard
- Subject(title)와 Action Plan 모두 표시하여 상세 정보 유지

### 7. 통계 계산
- `calcWeightedProgress` 등 기존 로직은 그대로 유지, 그룹 키만 변경

