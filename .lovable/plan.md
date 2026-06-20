## 사이드바 Design Management 그룹화

현재 사이드바에 세 항목(Design Dashboard / Design Summary / Design Raw Data)이 평면(flat)으로 나열되어 있음. 이를 접고 펼 수 있는 **Design Management** 부모 메뉴로 묶고 하위에 Dashboard, Summary, Raw Data를 둠.

### 수정 파일
- `src/components/layout/AppSidebar.tsx`

### 구현 방식
- shadcn `Collapsible` + `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` 사용
- 부모 항목: 라벨 "Design Management", 아이콘 `Briefcase`(또는 `Building2`), 클릭 시 열기/닫기. 현재 경로가 `/design`로 시작하면 기본 열림(`defaultOpen`)
- 하위 항목 3개:
  - Dashboard → `/design/dashboard` (icon `LayoutDashboard`)
  - Summary → `/design/summary` (icon `History`)
  - Raw Data → `/design` (icon `Database`, `end` prop으로 정확 매치)
- 권한: 기존과 동일하게 `adminOrPmOnly` (Admin/PM만 그룹 자체가 표시됨). Guest/SuperGuest는 그룹 비표시
- collapsed(아이콘 모드) 상태일 때는 부모 아이콘만 노출하고 클릭 시 sidebar가 자동 확장되어 하위가 보임 (shadcn 기본 동작)
- 기존 3개의 평면 항목(`allNavItems` 배열 line 24-26) 제거

### 그 외
- 기능/라우트 변경 없음. UI 그룹화만 진행
- 모바일에서 하위 클릭 시 `setOpenMobile(false)` 유지
