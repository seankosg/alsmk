
## 변경 요약

1. **헤더 글자색 시인성 개선** — 스테이지 헤더(SD/DD/CD)와 2단(날짜·라벨)·3단(P/A/Δ)의 텍스트를 `text-black font-bold`로 통일. 배경(스카이/앰버/에메랄드 톤)은 유지하되 채도를 약간 올려 검정 텍스트와 대비 확보.

2. **좌측 DWG 컬럼 2단 구조화**
   - 1단(헤더): `Total DWG`
   - 2단(헤더 보조): `SD / DD / CD` 라벨
   - 본문(각 Block×Disc 행): 해당 행에서 Raw Data의 `in_scope_sd / in_scope_dd / in_scope_cd` 가 `true`("O")인 도면 개수를 각각 표시 (`12 / 10 / 8` 형태 또는 3-column subgrid)

## 기술 변경

### `src/lib/mdr/milestoneMonitorEngine.ts`
- `MonitorDiscRow` 에 `drawingCountSD / drawingCountDD / drawingCountCD: number` 추가.
- `buildMatrix()` 에서 그룹 도면 순회 시 `isInScope(d, "SD"|"DD"|"CD")` 카운트하여 세팅.
- `saveSnapshot()` 에 `drawing_count_sd / dd / cd` 컬럼 포함.
- `loadLatestSnapshot()` 에서 해당 컬럼 복원 (모든 행이 동일 값이므로 첫 행 값 사용).

### DB 마이그레이션 (`mdr_milestone_snapshots`)
```sql
ALTER TABLE public.mdr_milestone_snapshots
  ADD COLUMN drawing_count_sd integer NOT NULL DEFAULT 0,
  ADD COLUMN drawing_count_dd integer NOT NULL DEFAULT 0,
  ADD COLUMN drawing_count_cd integer NOT NULL DEFAULT 0;
```

### `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- `STAGE_THEME` 재구성: `head`(배경) 진하게 + 텍스트는 모두 `text-black font-bold` 적용. 2단/3단도 `text-black font-semibold` 로 통일.
- 1단 헤더 `<th rowSpan={3}>DWG</th>` 제거. 대신:
  - 1단: `<th rowSpan={2} colSpan={3}>Total DWG</th>`
  - 2단: `<th>SD</th><th>DD</th><th>CD</th>` (3단의 P/A/Δ 행은 DWG 영역에 대해 비움 또는 `rowSpan` 처리)
- 본문 행: 기존 단일 `DWG` 셀을 3개 셀(`drawingCountSD/DD/CD`)로 분리, `tabular-nums text-center`.
- 헤더 구조 재정렬: Block/Disc 도 `rowSpan={3}` 그대로 유지, DWG 만 2단 구조.

### 검증
- `npm run build` (tsgo)
- Playwright 로 `/design` 진입 후 "신규 계산" 클릭하여 스냅샷 저장 → 새로고침 후 SD/DD/CD 개수가 표시되는지 스크린샷.
