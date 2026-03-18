

## Task 입력 페이지 완성도 향상 계획

현재 Workspace의 Task 관련 기능에서 부족한 부분을 보완합니다.

---

### 1. TaskDetailDialog → 편집 가능하게 전환
현재 읽기 전용인 상세 다이얼로그를 편집 모드로 전환합니다.

**편집 가능 필드:**
- **Actual %** — 슬라이더 또는 숫자 입력 (0~100)
- **Actual Finish** — 날짜 선택
- **Action Plan** — 텍스트 편집
- **Issue Flag** — normal / warning / critical 선택
- **Issue Description** — 이슈 시 설명 입력

**동작:** 저장 버튼 클릭 시 DB 업데이트 → react-query 캐시 무효화 → 토스트 알림

### 2. Task 삭제 기능 추가
TaskDetailDialog 하단에 삭제 버튼 추가. 확인 다이얼로그(AlertDialog) 후 삭제 실행.

### 3. Task 테이블 인라인 Actual % 편집
테이블의 Actual % 셀을 클릭하면 숫자 입력 필드로 전환, 블러/Enter 시 즉시 DB 저장. 빠른 진행률 업데이트를 위한 편의 기능.

### 4. AddTaskDialog에 created_by 저장
현재 `created_by` 필드가 null로 저장됨. 현재 로그인한 user의 auth.uid()를 `created_by`에 기록하도록 수정.

---

### 구현 파일

| 파일 | 변경 내용 |
|------|----------|
| `TaskDetailDialog.tsx` | 읽기→편집 전환, Actual %, Actual Finish, Action Plan, Issue Flag/Description 편집, 삭제 버튼 |
| `TaskTable.tsx` | Actual % 인라인 편집 |
| `AddTaskDialog.tsx` | created_by 필드 추가 |

DB 변경 없음 — 모든 필드가 이미 tasks 테이블에 존재합니다.

