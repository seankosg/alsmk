## 변경 요약 (설계진도율 패널 한정)

### 1. 팀 표시 순서 재정렬 → ARCH, STR, MECH, ELEC
- `MdrMilestoneMonitorPanel.tsx`의 `displayRows` 정렬에서 팀 비교를 `localeCompare`(알파벳) 대신 `TEAMS` 배열(`["ARCH","CIVIL","STR","MECH","ELEC"]`) 기준 인덱스 비교로 변경.
- 결과: 표시 행이 ARCH → STR → MECH → ELEC 순. CIVIL/기타는 뒤로 정렬(데이터 존재 시).

### 2. Block 표시: `GEN` → `GENERAL`
- 내부 코드값은 `GEN` 유지(데이터/필터 키 깨짐 방지). 표시 라벨만 매핑.
- 적용 위치:
  - 본문 Block 컬럼 (`{row.building}` → `displayBuilding(row.building)`)
  - 합계행 라벨 (`renderAggRow`의 label 인자)
  - 필터바 Building 탭 (`MdrSummaryFilterBar`의 `<TabsTrigger>` 표시 텍스트)
- 헬퍼: `displayBuilding(code) = code === "GEN" ? "GENERAL" : code` 를 `MdrMilestoneMonitorPanel.tsx` 상수 영역에 추가하고, 필터바에는 inline 처리 또는 동일 헬퍼 export.

### 3. 필터탭 Building 순서: FAFP ↔ MAIN_OFFICE 교체
- `BUILDING_ORDER`를 `["GEN", "SMP&CCM", "HSM", "CRM", "MAIN_OFFICE", "FAFP"]`로 변경.
- 공장동/사무동 분류(`FACTORY_BUILDINGS`)는 변경 없음(FAFP는 공장동 유지). 공장동 합계행 위치는 `lastFactoryBuilding`이 동적 계산이므로 자동 반영(CRM이 마지막 공장동이 되어 그 아래에 공장동 합계행 표시).
- 미사용 상수 `LAST_FACTORY_BUILDING`은 그대로 두어 부수영향 없음.

## 작업 파일
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
- `src/components/mdr/MdrSummaryFilterBar.tsx`

## 비변경
- 산식/가중치/엔진 로직, 다른 패널(요약/CPM 등), DB/seed 데이터.