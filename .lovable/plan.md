## 목표

Raw Data 그리드의 마일스톤 컬럼을 더 평탄(flat)하게 만들어, 정렬·필터·엑셀 export가 마일스톤 지표별로 가능하도록 합니다.

- 현재: `DD30 P/A/Δ` 한 셀에 세 값(`30 / 12 / 18`) 묶음 표시
- 변경: 마일스톤마다 `Plan`, `Actual`, `Δ` 컬럼 3개로 분리
- SD도 50%, 100% 마일스톤 컬럼 추가 (DD/CD와 동일 구조)

## 컬럼 구조 (변경 후)

스테이지별 마일스톤 (DB 실 데이터 기반):

- SD: 50, 100 → 6 컬럼
- DD: 30, 60, 90, 100 → 12 컬럼
- CD: 30, 60, 100 → 9 컬럼

총 27개 마일스톤 컬럼이 생깁니다.

```text
... | SD50 P | SD50 A | SD50 Δ | SD100 P | SD100 A | SD100 Δ |
    | DD30 P | DD30 A | DD30 Δ | DD60 P | DD60 A | DD60 Δ | ... |
    | CD30 P | CD30 A | CD30 Δ | ...                              |
```

헤더 라벨은 공간 절약을 위해 `P` / `A` / `Δ` 단축 표기(툴팁으로 Plan/Actual/Delta 안내).

## 동작 규칙

- 값 계산 로직(`buildCell`)은 그대로 유지: `Plan = increment_pct`, `Actual = is_done이면 increment_pct, 아니면 0`, `Δ = Plan − Actual`.
- 해당 마일스톤이 도면에 존재하지 않으면 세 컬럼 모두 `-` 표시.
- `Δ` 컬럼은 기존 `deltaCls` 색상 규칙(녹/노/적) 그대로 적용.
- 각 분리 컬럼은 정렬 가능(`enableSorting: true`), 숫자 범위 필터(`progressFilterFn` 재사용) 활성화.
- 컬럼 토글 메뉴(Columns)에서 개별 표시/숨김 가능 → 사용자가 필요한 마일스톤만 보이게 할 수 있음.
- 기본 표시 상태: SD/DD/CD 마일스톤 모두 표시. 사용자가 숨겨두면 `useGridStatePersistence`로 유저별 영속화 유지.

## SD 마크 컬럼 처리

기존 단일 컬럼 `SD` (`O`/`-` 마크)는 의미가 SD 마일스톤 존재 여부였습니다. SD가 마일스톤 컬럼으로 세분화되므로 `SD/DD/CD` mark 컬럼 3개는 그대로 유지하되 기본 숨김(default hidden) 처리해 헤더 가독성을 확보합니다. 사용자가 필요시 Columns 메뉴에서 다시 표시 가능.

## Export

`exportFilteredXlsx`도 신규 컬럼 ID에 맞춰 헤더 라벨 매핑을 갱신:

- `sd_50_p`, `sd_50_a`, `sd_50_d`, … `cd_100_d` 등 ID 패턴
- 헤더는 `SD50 P`, `SD50 A`, `SD50 Δ` 형태로 출력
- 합쳐 표시하던 `formatCell`의 객체 분기는 제거(이제 각 셀이 숫자)

## 기술 변경 (개발자용)

수정 파일:

1. `src/components/mdr/grid/columns.tsx`
   - `MdrDrawingRow`에 `sdCells: Record<number, {p,a,delta}|null>` 추가, `ddCells`/`cdCells` 유지
   - 상수에 `SD_PCTS = [50, 100]` 추가
   - 기존 `ddStageCols`/`cdStageCols` 빌더를 폐기하고 `buildMilestoneColumns(stage, pcts)` 헬퍼로 일반화하여 마일스톤당 3개 `ColumnDef`(p/a/d) 생성
   - 컬럼 ID 규칙: `{stage}_{pct}_p|a|d` (예: `dd_30_p`)
   - 각 ColumnDef: `accessorFn`으로 해당 값 반환, `cell`에서 `-`/숫자 분기 렌더, `meta.filterType: "text"` + `progressFilterFn`

2. `src/components/mdr/grid/MdrAdvancedGrid.tsx`
   - `rows` 생성 시 `sdCells` 채우기 (SD_PCTS 사용)
   - `exportFilteredXlsx` `headerLabel` 맵을 신규 ID 27종에 맞게 확장(루프로 생성)
   - `formatCell`에서 `{p,a,delta}` 객체 분기 제거 (분리 후 모두 숫자/`-`)
   - `sd_mark`/`dd_mark`/`cd_mark` 초기 `columnVisibility`에 `false` 추가 (영속화된 상태가 없을 때만 적용)

3. 영속화 충돌 방지
   - 기존 사용자에 `dd_30`, `cd_60` 등 옛 ID의 visibility/sorting 상태가 남아있을 수 있음 → `useGridStatePersistence`에 storage 버전 키 bump (예: `mdr-raw-grid-state` → `mdr-raw-grid-state:v2`) 또는 로딩 시 유효하지 않은 컬럼 ID를 자동 필터링하는 정리 단계 추가. 후자(필터링) 채택: 깨끗하면서 기존 사용자가 설정한 size/filter는 유효한 컬럼만 보존됨.

## 비범위 (이번 단계 제외)

- Summary 패널의 마일스톤 분리는 별건 — Summary는 스테이지 단위 집계 유지.
- DB 스키마 변경 없음.
- Data Date 선택 UI는 별도 단계.
