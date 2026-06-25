## 목표
1. SUMMARY 매트릭스를 **Block → Team(5개) → Discipline** 3단계 구조로 재편
2. 테이블 상단에 SHAW CMS Defect Progress 스타일의 **탭형 필터 툴바**(건물별 / 팀별 / Discipline별) 추가

---

## Part A: 3단계 계층 (Block → Team → Discipline)

### Team(5개) ↔ Discipline 매핑
| Team | 소속 Discipline |
|------|-----------------|
| **Arch**  | ARCH |
| **Civil** | CIVIL |
| **STR**   | STR |
| **Mech**  | MECH, FP |
| **Elec**  | ELEC, FA |

- FAFP는 **FP(Mech) / FA(Elec)** 으로 분리. 기존 `FAFP` 입력은 마이그레이션 기간 동안 FP로 폴백.
- `FAFP_STAGE_WF`(SD 0 / DD 50 / CD 50)는 FP/FA Discipline에 한해 적용.

### 1. `src/lib/mdr/weights.ts`
- `TEAMS = ["ARCH","CIVIL","STR","MECH","ELEC"] as const`
- `TEAM_OF_DISCIPLINE`: `{ARCH:"ARCH", CIVIL:"CIVIL", STR:"STR", MECH:"MECH", FP:"MECH", ELEC:"ELEC", FA:"ELEC"}`
- `DEFAULT_TEAM_WF`: `{ARCH:0.45, CIVIL:0, STR:0.25, MECH:0.19, ELEC:0.11}` (사용자가 admin에서 조정)
- `normalizeDiscipline()`: `FP`, `FA` 신규 코드 처리. `FAFP`/`FIRE` → `FP`로 폴백.

### 2. `src/lib/mdr/summaryEngine.ts`
- 신규 인터페이스 `TeamCell { team; drawingCount; sd/dd/cd; teamProgress; disciplines: DiscCell[] }`
- `BlockSummary.cells` → `BlockSummary.teams: TeamCell[]` (Discipline은 Team 내부에 중첩)
- `computeBlock()`: Discipline 그룹 → Team 매핑 후 재집계. Team Stage 평균 = 도면 수 가중. `teamProgress` = stage WF 가중 평균. `blockProgress` = **Team WF** 가중 평균.
- `selectDisciplineRollup` → `selectTeamRollup`.

### 3. `src/components/mdr/MdrSummaryPanel.tsx`
- 표 구조: `Block | Team | Discipline | DWG | SD... | DD... | CD... | Disc% | Team%`
- Block은 Team 행 전체, Team은 Discipline 행 전체에 `rowSpan`.
- Team 정렬: `ARCH→CIVIL→STR→MECH→ELEC`.
- 소계: Team Sub-total + Block Sub-total 2단계.

### 4. `src/components/mdr/MdrWeightsEditor.tsx`
- Discipline WF 편집 UI → **Team WF** 5개 입력으로 교체.

---

## Part B: 탭형 필터 툴바 (SHAW Defect Progress 스타일)

### UI 구조
SUMMARY 테이블 카드 **위**에 별도 Card(`p-3`)로 툴바를 배치. 각 그룹은 `ToolbarGroup`(라벨 + 컨트롤)으로 감싸고 `Tabs`/`TabsList`/`TabsTrigger`(`h-8`/`h-6 px-2 text-xs`)로 탭 UI 구현.

```
┌─ [Building]  [All] [GEN] [SMP&CCM] [HSM] [CRM] [MAIN_OFFICE]
│  [Team]      [All] [Arch] [Civil] [STR] [Mech] [Elec]
│  [Discipline][All] [ARCH] [CIVIL] [STR] [MECH] [FP] [ELEC] [FA]
│  [초기화 ↻]
└────────────────────────────────────────────────────
```

### 동작
- **건물 필터**: 선택 시 해당 Block 1개만 표시. `All`은 전체.
- **팀 필터**: 선택 시 해당 Team 행만 표시(소속 Discipline 포함). Block 행은 유지하되 다른 Team 행은 숨김.
- **Discipline 필터**: 선택 시 해당 Discipline 행만 표시. 단, 선택된 Discipline이 속한 Team만 자동으로 잠금 표시.
- 3개 필터는 **AND 조합**.
- 모든 필터 상태는 URL 쿼리 파라미터(`?b=CRM&t=MECH&d=FP`)와 동기화 → 새로고침/공유 가능.
- 필터가 적용되면 Sub-total/blockProgress는 **필터 후 데이터 기준으로 재계산**(원본 summary는 불변, 클라이언트 측 필터링 후 동일 집계 함수 재호출).
- `초기화` 버튼으로 모든 필터를 `all`로 리셋.

### 컴포넌트
- 신규 `src/components/mdr/MdrSummaryFilterBar.tsx` — 위 툴바 컴포넌트.
- `MdrSummaryPanel`에서 필터 상태를 보유하고 `useMdrSummary()` 결과에 클라이언트 측 필터/재집계 적용.

### 재집계 헬퍼
`summaryEngine.ts`에 `filterAndRecompute(summary, {building, team, discipline})` 헬퍼 추가:
- 원본 `rawDrawings`가 아닌 이미 계산된 `summary.blocks`를 입력으로 받아 필터 후 Block/Team 소계만 재계산(Stage 평균은 도면 수 가중으로 재계산).
- 또는 단순하게 React에서 행만 숨기고 소계를 다시 계산하는 방식(성능 충분).

---

## DB / 데이터
- 스키마 변경 **없음**.
- `mdr_drawings.discipline`에 `FP`/`FA` 신규 값 등장 가능 → `normalizeDiscipline`이 처리.
- `mdr_weights` row(`discipline=ARCH/STR/MECH/ELEC/CIVIL`)는 그대로 Team WF로 사용. `FAFP` row는 숨김.

## 검증
1. 빌드 통과.
2. SUMMARY 화면이 5개 Team으로 그룹된 3단계 표로 렌더링.
3. 툴바에서 Building/Team/Discipline 탭 클릭 시 해당 행만 표시되고 Sub-total이 재계산.
4. URL 파라미터 동기화 확인(공유 링크로 동일 필터 복원).
5. `초기화` 버튼이 모든 필터를 리셋.
