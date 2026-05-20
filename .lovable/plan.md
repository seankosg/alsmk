# My Workspace 필터 강화 + 버전 갱신 로직 교체

SHAW PROJECT CMS의 Defect Raw Data 컬럼 필터 UX와 버전 새로고침 메커니즘을 본 프로젝트에 이식합니다.

---

## 1. 컬럼별 필터 (Defect Raw Data 방식 포팅)

### 1-1. 공통 컴포넌트 신규: `src/components/tasks/ColumnFilterDropdowns.tsx`
SHAW의 `src/components/raw-data/ColumnFilterDropdowns.tsx`를 그대로 포팅 (디자인 토큰만 본 프로젝트 기준):
- `MultiSelectDropdown` — 체크박스 + 카운트, Select all / Clear all, `(Empty)` 토큰
- `TextFilterDropdown` — 콤마 = AND, "Empty only" 옵션, Tip 표기
- `DateRangeDropdown` — From / To / Empty only
- 필터 함수: `multiSelectFilterFn`, `textFilterFn`, `dateRangeFilterFn`
- 트리거: `Filter` 아이콘 (활성 시 `text-primary`, 비활성 시 `text-muted-foreground/50`)

### 1-2. 컬럼별 필터 타입 매핑 (TaskTable 12개 컬럼)
| 컬럼 | 필터 타입 |
|---|---|
| Task Code, Subject, Action Plan | text |
| Assignee | multi-select (members) |
| Category | multi-select (실데이터 unique) |
| Start, Finish, Actual Finish | date-range |
| D-Day | text (숫자 검색) |
| Plan %, Actual %, 차이 % | text (formatPct 기반) |

### 1-3. TaskTable 변경 (`src/components/tasks/TaskTable.tsx`)
- 헤더 영역의 기존 `Select` 3개(All Members / All Teams / All Flags) **제거** — 컬럼 필터로 대체
- 각 `TableHead`에 라벨 + 정렬 아이콘 옆에 `<ColumnFilterDropdown column={...} />` 삽입 (헤더 클릭 정렬 동작과 충돌 방지를 위해 `stopPropagation`)
- 컬럼 필터 상태: `useState<Record<string, any>>({})` — TanStack을 도입하지 않고 본 프로젝트의 기존 수동 `filtered` 파이프라인에 통합
- `filtered` 계산 직후 `applyColumnFilters(filtered, columnFilters)` 단계 추가
- Faceted 카운트는 컬럼별로 `useMemo`로 계산 (현재 보이는 행 기준)
- 활성 필터가 1개라도 있으면 카드 헤더 좌측 "Tasks (N)" 옆에 `Clear filters` 버튼 노출
- Team / Member / Flag는 이제 컬럼 필터(multi-select)로 처리. `filterMode`에 따른 mine/team 기본 필터링 로직은 그대로 유지.

---

## 2. 헤더 탭형 필터: All / On Going Only

### 위치
TaskTable `CardHeader`의 `CardTitle` 줄 (현재 "Tasks (N)" 옆 또는 검색창 좌측)에 shadcn `Tabs` 추가:

```tsx
<Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as "all" | "ongoing")}>
  <TabsList className="h-8">
    <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
    <TabsTrigger value="ongoing" className="text-xs h-6">On Going Only</TabsTrigger>
  </TabsList>
</Tabs>
```

### 동작
- `ongoing` 선택 시: `current_progress < 100 && !actual_finish`인 행만 표시
- Summary task는 활성 하위가 1개라도 있으면 표시 (그룹 트리 유지)
- 기본값: `all`
- 컬럼 필터/검색/팀필터 등과 AND 결합

---

## 3. 버전 새로고침 로직 교체 (SHAW와 동일)

현재 `BuildInfo.tsx`(index.html 스크립트 src 폴링) + `NewBuildDialog.tsx`(PWA `__updateSW`) 조합을 SHAW의 `app-version.json` 방식으로 교체.

### 3-1. `vite.config.ts`
SHAW의 `appVersionPlugin` 추가:
- `process.env.VITE_APP_BUILD_ID || new Date().toISOString()`을 `buildId`로 사용
- `generateBundle`에서 `app-version.json` 에셋 생성
- `define: { __APP_BUILD_ID__: JSON.stringify(buildId) }`
- 기존 `__BUILD_TIME__` define은 제거(또는 buildId로 통일)
- 기존 `VitePWA` 설정은 유지 (PWA 캐싱 정책은 건드리지 않음). `registerSW`의 `onNeedRefresh` 콜백도 `app-version-mismatch` 이벤트로 통합.

### 3-2. 신규 파일
- `src/hooks/useAppVersionCheck.ts` — SHAW와 동일 (2분 폴링 + visibilitychange + online + `app-version-mismatch` 이벤트 → `/app-version.json?t=...` fetch → buildId 비교 → `updateAvailable` state)
- `src/components/layout/AppUpdateBanner.tsx` — SHAW와 동일한 상단 배너 (한국어 메시지 그대로). `useAppVersionCheck`로 노출 여부 결정.
- `src/components/layout/BuildInfoChip.tsx` — SHAW와 동일한 "New Version" 강제 새로고침 버튼 (`?__reset=...`로 cache-bust replace)

### 3-3. `src/components/layout/AppLayout.tsx`
- 헤더에 기존 `<BuildInfo />` 자리에 `<BuildInfoChip />` 배치
- 레이아웃 최상단(헤더 위 또는 아래)에 `<AppUpdateBanner />` 마운트

### 3-4. `src/main.tsx`
- `registerSW`의 `onNeedRefresh`에서 `window.dispatchEvent(new Event("app-version-mismatch"))`로 변경 (기존 `new-build-available` 대신 SHAW 이벤트명 사용)
- `window.__updateSW` 노출은 유지 (모바일 캐시 강제 갱신용)

### 3-5. 삭제 / 정리
- `src/components/BuildInfo.tsx` 삭제
- `src/components/NewBuildDialog.tsx` 삭제 (배너 + 헤더 칩으로 대체)
- `App.tsx` 등에서 `<NewBuildDialog />` 마운트 제거

---

## 변경 파일 요약
**신규**
- `src/components/tasks/ColumnFilterDropdowns.tsx`
- `src/hooks/useAppVersionCheck.ts`
- `src/components/layout/AppUpdateBanner.tsx`
- `src/components/layout/BuildInfoChip.tsx`

**수정**
- `src/components/tasks/TaskTable.tsx` (컬럼 필터 + On Going 탭)
- `src/components/layout/AppLayout.tsx` (칩 교체 + 배너 추가)
- `src/main.tsx` (이벤트명 통일)
- `vite.config.ts` (appVersionPlugin + `__APP_BUILD_ID__`)
- `App.tsx` (NewBuildDialog 제거)

**삭제**
- `src/components/BuildInfo.tsx`
- `src/components/NewBuildDialog.tsx`

## 기대 결과
- My Workspace 각 컬럼 헤더에서 SHAW Defect Raw Data와 동일한 필터 팝오버(다중선택/텍스트/날짜) 사용 가능
- 헤더에 All / On Going Only 탭으로 진행 중 task만 빠르게 토글
- 새 빌드 배포 시 상단 배너 + "New Version" 칩으로 즉시 cache-bust reload 가능 (SHAW와 동일한 신뢰성)
