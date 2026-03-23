

# ActivityTaskPanel 매핑 Task 관리 개선

## 변경 사항 요약

### 1. 삭제(X) 버튼 위치 변경 — task_code 좌측으로 이동
현재 행 우측 끝에 있는 매핑 해제(X) 버튼을 task_code 좌측으로 이동합니다.

### 2. 삭제 버튼 권한 제어
- `useAuthContext`에서 `isAdmin`, `memberId`를 가져옴
- 해당 task의 `assignee_id`가 현재 로그인 사용자의 `memberId`와 같거나, `isAdmin`인 경우에만 삭제 버튼 표시
- 권한이 없는 사용자에게는 버튼이 렌더링되지 않음

### 3. Hover 시 Task 상세 정보 툴팁 (HoverCard)
`@radix-ui/react-hover-card`(이미 설치됨)를 활용하여 각 Task 행에 마우스를 올리면 상세 정보 카드를 표시:
- Task Code, Title (전체 텍스트)
- 담당자, 팀명
- 시작일 ~ 종료일
- 실제 진행률 vs 계획 진행률, GAP
- Issue flag (있을 경우)

### 4. ExternalLink 버튼 제거
행 전체를 클릭하면 `/workspace?task=${task.id}`로 이동하도록 변경. 기존 ExternalLink 아이콘 버튼 제거.

## 기술 상세

### 수정 파일: `src/components/cpm/ActivityTaskPanel.tsx`

1. **Import 추가**: `useAuthContext` from AppLayout, `HoverCard/HoverCardTrigger/HoverCardContent` from ui/hover-card
2. **컴포넌트 내부**: `useAuthContext()`로 `isAdmin`, `memberId` 획득
3. **Task 행 구조 변경** (lines 358-394):

```text
변경 전:  [task_code] [title] [progress] [gap] [ExternalLink] [X]
변경 후:  [X(조건부)] [task_code] [title] [progress] [gap]
          행 전체 클릭 → Workspace 이동
          행 hover → HoverCard로 상세정보 표시
```

4. **HoverCard 내용**: task의 전체 title, team_name, assignee_name, start_date~end_date, current_progress/planned, gap, issue 정보
5. **TaskWithMember 인터페이스**에 `issue_flag`, `issue_description` 필드 추가 (tasks 테이블에서 select 시 포함)

