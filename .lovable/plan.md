# 근본 원인

`src/lib/mdr/summaryEngine.ts`의 `fetchSummary()`는 매트릭스 행(블록 목록)을 **`mdr_drawings`에서 발견된 `building_code`만 그룹화**하여 만듭니다.

DB 확인 결과:
- `mdr_buildings`(건물 마스터): CRM, HSM, MAIN_OFFICE, FAFP, GEN, **SMP&CCM** — 총 6개
- `mdr_drawings` distinct building_code: CRM, HSM, MAIN_OFFICE, FAFP, GEN — **5개** (SMP&CCM 도면 0건)

따라서 도면이 0건인 건물(현재 SMP&CCM, 또는 롤백/삭제 직후의 건물, 신규 등록 건물)은 화면에 **아예 표시되지 않습니다**. 임포트 전이라도 마스터에 등록된 건물은 골격(스켈레톤)으로 보여야 하며, 반대로 마스터에 등록되지 않은 채 임포트된 고아 building_code는 경고로 드러나야 합니다.

# 변경 사항

## 1. `src/lib/mdr/summaryEngine.ts` — 행 소스 전환

**a. 건물 마스터 함께 로드**
- `mdr_buildings`에서 `code, name, sort_order` 전체 fetch (병렬).

**b. 합집합 빌딩 키 생성**
- `buildingKeys = unique( masterCodes ∪ drawingCodes )`.
- 각 키마다 도면 배열(없으면 `[]`)로 `computeBlock` 호출.

**c. `computeBlock` 빈 도면 처리**
- 도면 0건이면: `cells = []`, `totals` 모두 `emptyCell()`, `blockProgress = 0`.
- 이 경우에도 행이 1줄은 보여야 하므로 `cells.length === 0`이면 **placeholder cell**(`discipline: "—", drawingCount: 0, sd/dd/cd: emptyCell()`) 1개를 푸시.

**d. `BlockSummary`에 메타 추가**
- `inMaster: boolean` — `mdr_buildings`에 등록되어 있는지.
- `hasDrawings: boolean` — 도면 1건이라도 있는지.
- 정렬 순서: `mdr_buildings.sort_order` → `buildingWf` 내림차순 → 코드 알파벳. 마스터에 없는 고아 코드는 항상 맨 아래.

**e. overall 집계 변경 없음**
- `contributesToOverall` 그대로 (`buildingWf > 0`만 합산) → 빈 건물이 추가되어도 전사 KPI 영향 없음.

## 2. `src/components/mdr/MdrSummaryPanel.tsx` — 빈 행/배지 처리

- placeholder cell(`discipline === "—"`)이면 DWG/모든 stage 셀에 `-` 표시 (기존 `StageCells`가 이미 `drawingCount === 0` 시 `-`를 출력하므로 그대로 동작).
- 블록 라벨 아래 배지 우선순위:
  1. `!inMaster` → 빨간 outline `"마스터 미등록"` (관리자에게 등록 유도)
  2. `inMaster && !hasDrawings` → 회색 outline `"도면 없음"` 
  3. `dim(!contributesToOverall)` → 기존 `"합산 제외"` 유지
  4. 그 외 → WF 표시
- `summary.blocks.length === 0` 빈상태 메시지 조건은 유지(마스터까지 0건일 때만 발동).

## 3. 영향 범위 확인

- `selectDisciplineRollup` / `selectStageRollup`: `contributesToOverall=false` 블록은 스킵하므로 영향 없음. 빈 placeholder cell도 `drawingCount=0`이라 분모에 0으로 들어가 결과 불변.
- `MdrKpiCards` 등 overall 사용처: 합산식 미변경.

# 검증

1. `/design/summary` 진입 시 매트릭스에 **SMP&CCM 행이 "도면 없음" 배지와 함께** 표시되는지 확인.
2. 마스터에 신규 건물 추가 → 즉시 행 출현(임포트 전).
3. 임포트 후 마스터에 없는 코드로 들어온 건물이 있다면 "마스터 미등록" 배지로 마지막 줄에 출현.
4. CRM/HSM 등 기존 합산 대상 행의 수치/Disc. Progress가 이전과 동일한지(스냅샷 비교).
