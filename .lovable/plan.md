

## 태스크 Import 중복 방지 방안

### 중복 판단 기준

태스크에는 고유 식별자(task_code)가 DB 트리거로 자동 생성되므로, 업로드 시점에는 사용할 수 없습니다. 따라서 **비즈니스 키 조합**으로 중복을 판단합니다:

- **Title + Assignee + Start Date + End Date** — 이 4가지가 동일하면 중복으로 간주

### 구현 방법

**파일**: `src/components/tasks/TaskImport.tsx`

1. **파일 파싱 후 기존 태스크 조회**: validation 단계에서 현재 DB의 tasks 테이블에서 `title`, `assignee_id`, `start_date`, `end_date`를 조회
2. **중복 체크 로직 추가**: 파싱된 각 행의 (title + assigneeId + startDate + endDate) 조합이 기존 DB에 이미 존재하면 해당 행에 "중복 태스크" 경고 추가
3. **UI 표시**:
   - 중복 행은 노란색 배경 + "Duplicate" 경고 뱃지로 표시
   - Status 컬럼에 "기존 태스크와 중복" 메시지 표시
4. **Import 시 처리 옵션**:
   - 중복 행은 기본적으로 **건너뛰기** (skip)
   - 사용자가 원하면 중복 포함 Import 가능하도록 "Include duplicates" 체크박스 제공

### 수정 범위
- `TaskImport.tsx`: 기존 tasks 조회 쿼리 추가 (~10줄), 중복 체크 로직 (~10줄), UI 경고 표시 (~10줄), 체크박스 옵션 (~5줄)

