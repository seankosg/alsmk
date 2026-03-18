

## 현황

- **Dashboard (`/`)** — 프로젝트 전체 현황 (모든 팀의 마일스톤, 히트맵, 이슈 등)
- **My Workspace (`/workspace`)** — 자신에게 배정된 태스크 테이블 + Import/Export
- 역할 구분: `isAdmin` (admin role) + `is_pm` (members 테이블 필드)
- Admin/PM은 프로젝트 전체를 관리, 일반 멤버는 자기 태스크 중심

## 제안 구조

### 페이지 재구성

| 경로 | 페이지명 | 접근 대상 | 내용 |
|------|----------|-----------|------|
| `/` | **Project Dashboard** | Admin, PM | 현재 Dashboard 그대로 (전체 프로젝트 현황) |
| `/my` | **My Dashboard** | 일반 멤버 | 개인 태스크 요약 + 관리 (아래 상세) |
| `/workspace` | My Workspace | 모두 | 태스크 테이블 (기존 유지) |

### 라우팅 로직

- 로그인 후 랜딩: Admin/PM → `/` (Project Dashboard), 일반 멤버 → `/my` (My Dashboard)
- 사이드바: Admin/PM에게는 "Project Dashboard" + "My Workspace", 일반 멤버에게는 "My Dashboard" + "My Workspace"
- 일반 멤버가 `/`에 접근 시 `/my`로 리다이렉트

### My Dashboard 구성 (신규 페이지)

개인에게 배정된 태스크만 기반으로 한 요약 대시보드:

1. **개인 KPI 카드 (상단)**
   - 총 배정 태스크 수
   - 완료율 (actual_finish가 있는 태스크 비율)
   - 미달 태스크 수 (Actual < Planned)
   - 평균 Gap%

2. **내 미달 태스크 리스트**
   - Gap이 마이너스인 태스크를 Gap 순 정렬
   - 클릭 시 TaskDetailDialog로 드릴다운
   - 직접 진행률 업데이트 가능

3. **내 마감 임박 태스크**
   - D-Day 7일 이내 태스크 표시
   - 진행률 바 포함

4. **내 태스크 진행 현황 차트**
   - 도넛 차트: 완료 / 진행중 / 미시작 비율

### 파일 변경 목록

1. **`src/pages/MyDashboard.tsx`** — 신규 생성
   - 로그인 사용자의 `memberId`로 tasks 필터
   - KPI 카드, 미달 리스트, 마감 임박, 도넛 차트 구성

2. **`src/pages/Index.tsx`** — 제목만 "Project Dashboard"로 변경

3. **`src/App.tsx`** — `/my` 라우트 추가

4. **`src/components/layout/AppLayout.tsx`** — 랜딩 리다이렉트 로직 추가
   - 일반 멤버가 `/`에 접근 시 `/my`로 리다이렉트

5. **`src/components/layout/AppSidebar.tsx`** — 사이드바 조건부 메뉴
   - Admin/PM: "Project Dashboard" (`/`)
   - 일반 멤버: "My Dashboard" (`/my`)
   - "My Workspace"는 모두에게 표시

### PM 판별

`members` 테이블의 `is_pm` 필드를 활용. `useAuth` 훅에 `isPm` 상태 추가:

```text
isPm = members.is_pm === true
isAdminOrPm = isAdmin || isPm
```

DB 변경 없음. 기존 `is_pm` 필드와 `user_roles` 테이블만 사용.

