## 목표
Design Dashboard와 Design Summary의 역할을 명확히 분리합니다.

- **Design Dashboard**: 전사/건물/분야 단위 요약 + 계획 대비 실적 + 주요 문제점 (한눈에 보기)
- **Design Summary**: 건물 × 분야 × Stage 상세 매트릭스 (깊게 보기) + WF 참조

## 변경 사항

### 1. `MdrSummaryPanel.tsx` (Design Summary)
**제거**:
- Overall Progress KPI 카드 (→ Dashboard로 이동)
- 최근 임포트 로그 (→ Dashboard로 이동)

**유지/축소**:
- Block × Discipline × Stage 매트릭스 (메인)
- WF 패널은 **참조용으로 축소 유지**: 3열 카드 → 한 줄 컴팩트 표기(접이식 Collapsible 또는 작은 footer 형태, 글자 크기 축소, Admin 링크는 작은 아이콘 버튼)

**추가** (상세 보기 강화):
- 건물/분야 필터, Stage(SD/DD/CD) 토글
- 셀에 **남은 도면 수, 지연 도면 수**(plan_date 경과 & 미완) 표시
- 행 클릭 시 해당 Block+Disc 도면 목록 드릴다운

### 2. `DesignDashboard.tsx` (현재 placeholder)
새로 구성:
1. **Overall Progress KPI** (Summary에서 이동: Overall % + 건물별 카드)
2. **건물별 현황 바차트** (blockProgress 가로 막대 + WF)
3. **분야별 현황 바차트** (ARCH/STR/MECH/ELEC/FAFP/CIVIL 가중 평균)
4. **계획 대비 실적 카드** (Stage별 Plan/Actual/달성률/지연)
5. **주요 문제점 보드** (plan_date 경과 & 미완 Top N, 마일스톤 누락)
6. **최근 임포트 로그** (Summary에서 이동)

WF는 Dashboard에 두지 않음 (Summary에 컴팩트 유지).

### 3. 데이터 계층
`src/lib/mdr/summaryEngine.ts` Dashboard·Summary 공통 사용.
보조 셀렉터 추가:
- `selectDisciplineRollup(summary)` — 분야별 가중 평균
- `selectStageRollup(summary)` — Stage별 Plan/Actual/지연
- `selectOverdueDrawings()` — plan_date < today & pct<100

### 4. 사이드바
`AppSidebar.tsx`의 Design Dashboard / Design Summary 라벨/툴팁 가볍게 보강 ("요약 KPI" vs "상세 매트릭스"). 라우트는 그대로.

## 구현 순서
1. `MdrSummaryPanel` 정리 — Overall/로그 카드 제거, WF 컴팩트화, 매트릭스에 필터·드릴다운·지연 컬럼 추가
2. `DesignDashboard` 본문 구현 — Overall/건물/분야/Stage/문제점/로그 카드
3. 보조 셀렉터·overdue 쿼리 hook 추가
4. 사이드바 라벨 보강

## 범위 외
- S-curve, 추세 차트 (Phase 2 유지)
- WF 편집 UI는 기존 Admin 그대로
