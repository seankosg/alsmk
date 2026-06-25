## 변경 대상
`src/components/mdr/MdrMilestoneMonitorPanel.tsx` (마일스톤 모니터링 테이블, Design Summary 페이지)

## 1. 헤더 라벨 변경
- 1단 헤더 `Overall Progress` → **`Progress Status`** (line 446 근처)
- 2단 헤더 `SD` / `DD` / `CD` → **`SD Stage` / `DD Stage` / `CD Stage`** (line 491 근처, STAGES.map 블록)

## 2. 새 컬럼 그룹 `Overall` 추가 (SD Stage 왼쪽)
헤더 구조:

```text
Progress Status
├─ Overall   (신규)         ├─ SD Stage  ├─ DD Stage  ├─ CD Stage
│  P │ A │ Δ                │ P│A│Δ      │ P│A│Δ      │ P│A│Δ
```

- 1단 `Progress Status` colSpan 9 → **12**
- 2단에 `Overall` (colSpan=3) 추가 — STAGES.map 앞에 삽입
- 3단에 `Overall` 의 P / A / Δ 셀 (colKey: `op-OVERALL-P/A/D`) 추가 (ResizeHandle 포함, STAGE_THEME 회색 톤 재사용)

## 3. Overall 본문 산식 (WF 토글 연동)
각 행마다 SD/DD/CD 단계 값 (`row.stageW[s]` WF ON / 마지막 마일스톤 cell WF OFF) 을 모아 합성:

- **WF ON**: `DEFAULT_STAGE_WF` (SD 0.2, DD 0.4, CD 0.4) 가중평균.  
  단계 값이 null 이면 해당 단계 가중치 제외 후 잔여 가중치로 정규화.  
  (FAFP 단일 discipline 행 등 SD=0 케이스도 자연 처리됨)
- **WF OFF**: 사용 가능한 단계들의 단순 평균.
- `delta = actual − plan` (둘 다 존재할 때만).

집계행 (`renderAggRow`) 의 Overall 도 동일 규칙으로 산출 — 단계별 가중평균(또는 단순평균)으로 먼저 단계값을 구한 뒤, 위와 같은 stage-WF 합성으로 Overall 1개 값 산출.

## 4. 컬럼 폭/정렬
- `colStyle("op-OVERALL-P|A|D")` 신규 키, 기본 폭은 단계 trio 셀과 동일.
- 본문 셀 클래스/포맷 (`fmtPct`, `fmtDelta`, `deltaClass`) 재사용.

## 5. 영향 없음
- DB / 엔진 (`milestoneMonitorEngine.ts`, `weights.ts`) 변경 없음.
- 다른 페이지·컴포넌트 변경 없음.
- 세부 마일스톤 펼침 영역, Total DWG, 필터, WF 토글 UI 그대로.

## 파일
- 수정: `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
