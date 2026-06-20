
## 목표
Design Management → Raw Data 그리드의 각 행에 **마일스톤별 Progress Icon(Pip 배지)** 컬럼을 추가한다. SHAW PROJECT CMS의 `StageProgress` 디자인(`●◐○⊘` + 색상 + 연결선 + 툴팁)을 차용하며, **SD는 단일 배지(100, 항상 완료 가정)** 로 표기하고, **SD/DD/CD 그룹별 접고 펼치기 토글**을 제공한다.

## 시각 디자인

기본(펼침) 상태 — 총 8개 Pip:
```text
SD ─ │ DD30 ─ DD60 ─ DD90 ─ DD100 │ ─ CD30 ─ CD60 ─ CD100
●        ●      ◐       ○      ○        ⊘      ○      ○
```

접기 상태 — 그룹당 1개 요약 Pip(가장 약한 state로 집계, 클릭하면 펼침):
```text
SD ─ DD ▸ ─ CD ▸
 ●    ◐      ⊘
```

- 배지: `h-4 w-4 rounded-full border`, 가운데 글리프, Pip 사이 2px 커넥터
- SD는 항상 1개(`SD100` = `done`). `progressEngine.drawingStagePct`에서 SD는 100% 고정 처리되어 있으므로 일관됨
- DD: 30/60/90/100 (4개), CD: 30/60/100 (3개)
- 그룹 사이에 얇은 세로 구분(`│`, `border-r border-border/40 mx-1`)으로 SD/DD/CD 시각 분리
- 각 그룹 라벨(`SD`, `DD`, `CD`)은 그룹 헤더 chevron 토글 버튼이 됨 (`▾`/`▸`)

### State 분류 (mdr_milestones + mdr_progress + asOf)
| State | 글리프 | 색상 | 조건 |
|-------|--------|------|------|
| done | `●` | `bg-success` | `progress.is_done = true` |
| delay | `⊘` | `bg-destructive` | 미완료 + `milestone.plan_date < asOf` |
| wip | `◐` | `bg-amber-400` | 미완료 + 직전 마일스톤 done + plan_date ≥ asOf |
| planned | `○` | 투명 + border | 그 외 정의된 마일스톤 |
| empty | `○` | 매우 흐림 | 도면에 해당 마일스톤이 없음 |

그룹 요약 state 우선순위: `delay > wip > planned > done > empty`.

### 툴팁 (hover)
```
Progress as of 2026-06-20
SD     : Done
DD30   : Done    · 02 May
DD60   : WIP     (plan 30 Jun)
DD90   : Planned (plan 31 Jul)
DD100  : Planned (plan 31 Aug)
CD30   : Delay   (plan 10 Jun, overdue 10d)
CD60   : Planned (plan 30 Sep)
CD100  : Planned (plan 31 Dec)
```

## 접기/펼치기 동작
- 컬럼 헤더 우측에 3개의 토글 버튼: `[SD] [DD ▾] [CD ▾]` (SD는 항상 1개라 토글 비활성)
- 클릭 시 해당 그룹만 접힘 → 해당 행 셀에서 그 그룹은 요약 Pip 1개로 렌더
- 상태는 `useGridStatePersistence` (localStorage)에 `mdr-grid:groupCollapsed = {sd:false, dd:false, cd:false}` 로 저장 → 새로고침 후 유지
- 접힘에 따라 컬럼 크기를 `getComputedWidth()`로 자동 보정 (펼침 230px → 모두 접힘 100px)
- 개별 행 셀에서 접힌 그룹의 요약 Pip를 클릭해도 동일 토글 (편의)

## 변경 범위 (frontend only)

### 1. 신규 — `src/lib/mdr/progressIcon.ts`
- `MdrMilestoneState`, `MdrPipCell` 타입
- `MDR_PIP_CLASS`, `MDR_PIP_GLYPH`, `MDR_STATE_LABEL` 상수
- `classifyMdrMilestoneState(...)`
- `buildMdrProgressIconCells(milestones, progress, asOf)` → `{ sd: PipCell, dd: PipCell[], cd: PipCell[] }`
- `summarizeGroupState(cells)` → 우선순위 기반 요약
- `getMdrProgressTooltipLines(...)`

### 2. 신규 — `src/components/mdr/grid/MdrProgressIconCell.tsx`
- props: `cells`, `asOf`, `collapsed: {sd,dd,cd}`, `onToggleGroup(stage)`
- 그룹별 펼침/접힘 분기 렌더, Radix `Tooltip` 사용
- `MdrProgressIconLegend` 별도 export
- `select-none`, `onClick stopPropagation`

### 3. 수정 — `src/components/mdr/grid/columns.tsx`
- `MdrDrawingRow`에 `progressIconCells` 필드 추가
- `Disc.` 다음에 `progress_icon` 컬럼 1개 삽입
  - `size: 230`(전부 펼침 기준), 접힘 시 `meta.collapsed`에 따라 셀에서 너비 시각 보정
  - `enableSorting: false`, multi-select 필터(Done/WIP/Planned/Delay)
- 컬럼 헤더는 `MdrProgressIconHeader`(그룹 토글 버튼 3개 포함) 사용
- 기존 27개 P/A/Δ 컬럼은 유지(기본 visibility false), `sd_*` 컬럼은 SD가 단일화되므로 `sd_100_*`만 남기고 `sd_50_*` 3개는 빌드에서 제외

### 4. 수정 — `src/components/mdr/grid/MdrAdvancedGrid.tsx`
- 행 빌더에 `buildMdrProgressIconCells(ms, pg, asOf)` 주입
- `groupCollapsed` state 추가, `useGridStatePersistence` 키 확장
- 헤더/셀에 `collapsed`, `onToggleGroup` 전달 (column meta로)
- 툴바 우측에 `<MdrProgressIconLegend />` 노출 (모바일 wrap)
- `SD_PCTS = [50, 100]` → `SD_PCTS = [100]` 로 변경하여 SD 세부 컬럼은 SD100만 유지

### 5. 수정 — `src/lib/mdr/exporter.ts` (사용 중인 export 경로)
- `progress_icon` 컬럼 케이스 추가: `"SD:Done|DD:WIP|CD:Delay"` 압축 표기로 출력
- 접힘 상태는 export에 영향 없음(항상 8개 raw state를 그룹 압축으로 출력)

### 6. 기본 컬럼 가시성
- 신규: `progress_icon = true`
- 기존 모든 `sd_*|dd_*|cd_*` P/A/Δ = `false` (기본 숨김, 컬럼 메뉴에서 ON 가능)
- 기존 사용자의 영속 상태는 보존(키 마이그레이션 없이 신규 컬럼은 default visible)

## 비변경
- DB 스키마, `progressEngine.ts` 계산, CPM, 대시보드, RLS/권한 모두 그대로
- 다크/라이트 토큰 모두 호환 (semantic 토큰만 사용)
- 정렬/필터/가상화/리사이즈 등 그리드 동작 그대로

## 검증
1. Playwright `/design` → 건물 시트 진입 → Progress 컬럼에 SD(1) + DD(4) + CD(3) Pip 표시 스크린샷
2. 행 hover → 툴팁 8개 라인 표시
3. 헤더 `[DD ▾]` 클릭 → DD 그룹이 요약 Pip 1개로 접힘, 새로고침 후에도 유지
4. 필터 `Delay` → 8개 state 중 Delay 포함 행만 노출
5. 컬럼 메뉴에서 `DD60 P/A/Δ` ON → 기존 컬럼 정상 동작
6. Export view → `progress_icon` 압축 표기 포함

## 산출물
- 신규: `src/lib/mdr/progressIcon.ts`, `src/components/mdr/grid/MdrProgressIconCell.tsx`
- 수정: `src/components/mdr/grid/columns.tsx`, `src/components/mdr/grid/MdrAdvancedGrid.tsx`, `src/components/mdr/grid/useGridStatePersistence.ts`, `src/lib/mdr/exporter.ts`
