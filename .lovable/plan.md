## 목표
다음 두 화면만 시인성 높은 라이트 테마(Cloud White)로 전환. 그 외 모든 화면(대시보드·사이드바·CPM·Messages 등)은 다크 유지.
- `/design` Raw Data
- `/workspace` My Workspace

선택안: v3 High-density Pro Grid
- 배경 `#fafbfc`, 카드 `#ffffff`, 경계선 `#e8ecf1`, 보조 텍스트 `#94a3b8`, 액센트 `#3b82f6`
- 헤더 `JetBrains Mono`, 본문 `Work Sans` (기존 Inter 유지 가능)
- 마일스톤/그룹 헤더 색조 구분(blue/indigo/emerald-50/30) + 좌측 구분선
- Δ 음수=emerald, 양수=red, 0/빈=slate-400
- 헤더 sticky, hover 행 하이라이트, 약한 zebra

## 변경 범위 (frontend 전용, 비즈니스 로직 0)

### 1. 라이트 스코프 클래스 도입 — `src/index.css`
전역 다크는 그대로 두고, 스코프 클래스 내부에서만 semantic token을 라이트로 재정의.

```css
.light-scope {
  --background: 220 20% 98%;
  --foreground: 222 30% 15%;
  --card: 0 0% 100%;
  --card-foreground: 222 30% 15%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 30% 15%;
  --muted: 220 15% 95%;
  --muted-foreground: 215 15% 50%;
  --accent: 220 15% 95%;
  --accent-foreground: 222 30% 15%;
  --border: 218 22% 92%;
  --input: 218 22% 92%;
  --primary: 215 90% 55%;
  --primary-foreground: 0 0% 100%;
  color-scheme: light;

  /* Raw Data 보조 토큰 */
  --rd-header: 220 25% 96%;
  --rd-subheader: 220 25% 98%;
  --rd-group-sd: 215 90% 96%;
  --rd-group-dd: 235 80% 96%;
  --rd-group-cd: 160 60% 94%;
  --rd-delta-pos: 0 72% 51%;
  --rd-delta-neg: 160 65% 38%;
}
```

### 2. 페이지 래퍼에 스코프 부여
- `src/pages/DesignManagement.tsx` 최상위 컨테이너에 `light-scope bg-background text-foreground` 추가 (기존 `space-y-6` 유지).
- `src/pages/Workspace.tsx` 최상위 컨테이너에 동일하게 적용.

사이드바·글로벌 헤더는 `AppLayout` 바깥이라 영향 없음(확인 필요 시 `AppLayout`만 view).

### 3. Raw Data 그리드 시각 갱신
`src/components/mdr/grid/MdrAdvancedGrid.tsx`:
- 컨테이너: `bg-card border border-border rounded-lg`
- 헤더: `bg-[hsl(var(--rd-header))] text-muted-foreground uppercase tracking-wider text-[10px] font-semibold font-mono`
- 서브헤더(P/A/Δ): `bg-[hsl(var(--rd-subheader))] text-[9px]`
- 행: `divide-y divide-border`, hover `hover:bg-muted/60`, even `bg-muted/30`
- 셀: `text-xs text-foreground`, 보조 `text-muted-foreground`

`src/components/mdr/grid/columns.tsx`:
- 마일스톤 그룹 헤더에 `bg-[hsl(var(--rd-group-sd|dd|cd))] border-l border-border`
- Δ 셀: 부호별 `text-[hsl(var(--rd-delta-pos|neg))] bg-red-50/40` 또는 `bg-emerald-50/40`, 0/빈 `text-muted-foreground italic`
- Discipline pill: `bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] uppercase`

### 4. Workspace 시각 갱신 (라이트 톤 적용 + 최소 정돈)
`src/pages/Workspace.tsx` 및 `src/components/tasks/TaskTable.tsx`(있는 컬럼 헤더/카드들):
- 모든 hardcoded 색상 클래스(`bg-slate-800`, `text-white` 등) 검색·제거 → semantic token으로 치환
- 카드/패널 `bg-card border border-border`
- TaskTable 헤더: `bg-muted text-muted-foreground uppercase text-[10px] font-semibold`
- 행 hover: `hover:bg-muted/60`
- 상태 뱃지: 기존 Badge variant 유지(토큰 따라 자동 라이트 전환)

조사 단계에서 `Workspace.tsx`와 `TaskTable.tsx`를 view하여 하드코딩된 다크 색상 위치를 식별 후 일괄 정리.

### 5. 폰트
프로젝트는 이미 `JetBrains Mono`(헤더) + `Inter`(본문) 사용 중. Work Sans는 도입하지 않고 기존 Inter 유지(타이포 변동 최소화). 필요 시 본문 weight만 미세 조정.

## 비변경 영역
- AppSidebar, AppLayout 헤더, Dashboard, MyDashboard, CPM, Messages, Calendar, Admin, Organization 등 라우트는 다크 유지
- 데이터 fetch/정렬/필터/가상화 로직, 컬럼 구조, 권한 모두 그대로
- Toast/Dialog 등 portal 컴포넌트는 전역 토큰 사용 → 다른 화면에서 열어도 다크 톤 유지

## 검증
1. Playwright로 로그인 → `/design` 진입: 라이트 톤, 헤더 sticky, Δ 색, 정렬 동작 회귀 없음 스크린샷
2. `/workspace` 진입: 라이트 톤, TaskTable 가독성, hover/필터 동작 스크린샷
3. `/` 대시보드: 다크 그대로 유지 스크린샷
4. 다이얼로그 1개(Task 상세) 열어 portal 컴포넌트 톤 확인

## 산출물
- 수정: `src/index.css`, `src/pages/DesignManagement.tsx`, `src/pages/Workspace.tsx`, `src/components/mdr/grid/MdrAdvancedGrid.tsx`, `src/components/mdr/grid/columns.tsx`, (필요 시) `src/components/tasks/TaskTable.tsx` 외 하드코딩 다크 색상 제거 대상 파일
