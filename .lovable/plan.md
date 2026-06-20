## 목표

`Design Raw Data` 그리드의 **개별 도면 행**에서 각 마일스톤(SD100, DD30/60/90/100, CD30/60/90/100)의 정보를 5개 하위 컬럼으로 분리해 표시할 수 있게 합니다.

- 시트 단위 집계표(이미 합의된 plan)에서는 7컬럼(도면수 포함)
- 개별 도면 행에서는 5컬럼(도면수 제외): **계획완료일 · 실적완료일 · 계획% · 실적% · 차이%**
- 새 컬럼들은 **기본 숨김**, Columns 메뉴에서 켜기

## 컬럼 구성

각 마일스톤(SD100, DD30, DD60, DD90, DD100, CD30, CD60, CD90, CD100)마다 5컬럼 → 총 45 컬럼:

| Suffix | 헤더 | 값 | 표시 |
|---|---|---|---|
| `_pd` | `{MS} 계획일` | `mdr_milestones.plan_date` | `YYYY-MM-DD` 또는 `-` |
| `_ad` | `{MS} 실적일` | `mdr_progress.actual_date` (is_done=true) | `YYYY-MM-DD` 또는 `-` |
| `_p`  | `{MS} P%` | 도면별 보간 계획% (해당 마일스톤 한 점) | 반올림 정수 |
| `_a`  | `{MS} A%` | 해당 마일스톤 is_done이면 `increment_pct`, 아니면 0 | 반올림 정수 |
| `_d`  | `{MS} Δ%` | `P% − A%` (deltaCls 색상) | 반올림 정수 |

기존 `_p / _a / _d`(3컬럼) 형식과 호환되도록 ID 스킴 유지하고, `_pd / _ad` 두 컬럼만 신설.

### 도면 행에서의 계산 규칙

- 계획완료일 `_pd`: 해당 도면의 `(stage, pct)` 마일스톤 row의 `plan_date`
- 실적완료일 `_ad`: 해당 도면의 `(stage, pct)` progress row 중 `is_done=true`인 `actual_date`. 없으면 `-`
- 계획% `_p`: 도면 단위 해당 마일스톤까지의 누적 계획%
  - 시작일 = 직전 마일스톤 `plan_date + 1일` (없으면 현재 `plan_date − 7일`)
  - 종료일 = 현재 `plan_date`
  - `asOf ≥ 종료일` → `increment_pct 누적합`까지
  - `asOf < 시작일` → 이전 누적까지
  - 그 사이 → 이전 누적 + `increment_pct × (asOf − 시작일)/(종료일 − 시작일)`
  - SD100은 항상 100
- 실적% `_a`: 해당 마일스톤이 `is_done`이면 `increment_pct`, 아니면 0 (기존 정책 유지)
- 차이% `_d`: `_p − _a`, `deltaCls(threshold)`로 색상

## UI/UX

- 기본 숨김: `columnVisibility`에 새 `_pd / _ad` 컬럼은 모두 `false`로 초기화 (기존 `_p/_a/_d`와 동일 정책 유지)
- Columns 드롭다운 메뉴에서 마일스톤별로 묶여 보이도록 `header` 문자열 일관화: `"{MS} 계획일"`, `"{MS} 실적일"`, `"{MS} P"`, `"{MS} A"`, `"{MS} Δ"` (예: `DD60 계획일`)
- 셀: 날짜는 `text-center tabular-nums`, 숫자는 우측 정렬 `tabular-nums`
- 정렬: 날짜는 ISO 문자열 lexical, 숫자는 numeric
- 필터: 날짜는 `dateRangeFilterFn`, 숫자는 `progressFilterFn`

## 파일 변경

수정
- `src/components/mdr/grid/columns.tsx`
  - `MdrDrawingRow` 인터페이스: `sdCells/ddCells/cdCells` 셀 형식에 `planDate?: string | null; actualDate?: string | null` 추가
  - `buildMilestoneCols`: 각 pct마다 `_pd`, `_ad` 컬럼 2개 추가 (기존 `_p/_a/_d` 옆)
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`
  - `buildCell` 헬퍼에서 `planDate`(`m.plan_date`), `actualDate`(`p.actual_date`) 채움
  - `_p` 계산을 기존 `increment_pct` 단발 표시가 아닌 **도면 단위 누적 보간**으로 교체 (신규 헬퍼 `drawingMilestonePlannedPct(milestones, stage, pct, asOf)` 사용)
  - `columnVisibility` 초기 defaults에 `_pd` `_ad` 정규식 추가 → 기본 숨김
- `src/components/mdr/grid/useGridStatePersistence.ts`
  - 컬럼 ID 화이트리스트 정규식 갱신 (`/^(sd|dd|cd)_\d+_(p|a|d|pd|ad)$/`)
- `src/lib/mdr/progressEngine.ts`
  - 신규 함수 `drawingMilestonePlannedPct(milestones, stage, pct, asOf): number` — 위 보간식 단일 마일스톤까지의 누적 계획% 반환
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`의 `exportFilteredXlsx`
  - `headerLabel` 정규식과 `formatCell` 분기에 `_pd`, `_ad` 처리 추가 (날짜는 문자열 그대로)

## 검증

- Playwright로 `/design` → SHAW 시트:
  - 기본 진입 시 새 날짜 컬럼이 숨겨져 있는지 확인
  - Columns 메뉴에서 `DD60 계획일`, `DD60 실적일` 켰을 때 그리드에 정확한 날짜 노출
  - 임의 도면의 DD60 P% 값이 보간식과 일치(직전 마일스톤 plan_date+1 → DD60 plan_date 사이 일자 보간)
  - asOf 변경에 따라 P%/Δ% 가 재계산
  - Export view로 내보낸 xlsx에 날짜/숫자 헤더 정상 표기

## 비고

- 도면 단위 행에서 도면수(계획/실적/차이) 컬럼은 의미가 없어 제외 (집계표에서만 표시)
- 기본 숨김 정책으로 인해 초기 그리드 가로폭은 변하지 않음
