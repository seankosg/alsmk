## 목표
현재 My Workspace의 Export는 `xlsx`의 `json_to_sheet`로 단순 데이터만 출력합니다. SHAW PROJECT CMS의 Defect Excel export처럼 **타이틀/메타/헤더/데이터 스타일링, 컬럼 너비, 행 높이, freeze pane, 날짜 셀, 숫자/퍼센트 포맷**을 적용해 전문적인 보고서 형태로 개선합니다.

## 구현 내용

### 1. `xlsx-js-style` 패키지 추가
스타일링 지원을 위해 `xlsx-js-style`을 의존성으로 추가 (SHAW와 동일).

### 2. 공유 스타일 모듈 신규 작성 — `src/lib/excelStyles.ts`
SHAW의 `excel-export.ts`에서 다음을 그대로 포팅:
- `FONT_NAME = 'Calibri'`
- `STYLE_TITLE` (네이비 배경 #1E3A5F, 흰색 굵은 14pt)
- `STYLE_META_LABEL`, `STYLE_META_VALUE` (연회색 배경 #F3F4F6)
- `STYLE_HEADER` (다크 슬레이트 #334155, 흰색 굵은 11pt, 가운데 정렬, 테두리)
- `STYLE_DATA` (11pt, 좌측 정렬, 연한 테두리 #E5E7EB)
- `setCell(ws, r, c, value, style)`, `setNumberCell`, `setDateCell` 헬퍼

추가로 ALSMK용 변형:
- `STYLE_SUMMARY_ROW` — Summary 행 강조용 옅은 파랑 배경
- `STYLE_SUBTASK_INDENT` — 서브태스크 들여쓰기 시각화
- `STYLE_GAP_POS` (녹색), `STYLE_GAP_NEG` (빨강) — 차이% 색상 분기

### 3. `src/pages/Workspace.tsx` — `handleExport` 재작성

#### 레이아웃 (SHAW 패턴 그대로)
```
Row 0: "ALSMK Project — My Workspace Tasks Export"   (STYLE_TITLE, 모든 컬럼 머지)
Row 1: Exported: YYYY-MM-DD HH:MM  by  사용자명     (STYLE_META_LABEL)
Row 2: Source: My Workspace                          (STYLE_META_VALUE)
Row 3: Filter: {On Going Only | All}                 (STYLE_META_VALUE)
Row 4: Total Tasks: N (Summary: x, Subtask: y, Task: z) (STYLE_META_VALUE)
Row 5: (공백)
Row 6: 컬럼 헤더 (STYLE_HEADER, 높이 28pt)
Row 7+: 데이터
```

#### 셀 타입 분기
- Start/Finish/Actual Finish → `setDateCell` + `dd-mmm-yy` numFmt (Excel 직렬 날짜)
- Plan % / Actual % → 숫자 + `0"%"` 포맷
- 차이 % → 숫자 + 색상 스타일 분기 (양수 녹색, 음수 빨강)
- D-Day → 문자
- Summary 행은 `STYLE_SUMMARY_ROW` 적용
- Subtask "Type" 컬럼은 들여쓰기 유지

#### Freeze pane & 컬럼 너비
- `ySplit: 7` (헤더 고정), `xSplit: 3` (Type, Task Code, Assignee 고정)
- 컬럼별 `wch` 지정: Task Code 14, Subject 36, Action Plan 32, Comments 50, 날짜 12, % 9 등

#### 파일명
`ALSMK_Workspace_Tasks_YYYYMMDD_HHMM.xlsx` (SHAW 타임스탬프 컨벤션)

#### 시트명
`Action Plan` (기존 유지)

### 4. 필터 컨텍스트 반영
현재 TaskTable의 `statusTab` (All / On Going Only)과 컬럼 필터를 export 메타에 표시하려면 Workspace ↔ TaskTable 간 상태 공유가 필요. 1차 구현에서는 `statusTab` 값을 lift-up하지 않고 메타 행에 `"Filter: (current view)"` 정도로만 표시하고, 추후 필요 시 props로 전달하도록 단순화.

## 변경 파일
- 신규: `src/lib/excelStyles.ts`
- 수정: `src/pages/Workspace.tsx` (handleExport)
- 수정: `package.json` (xlsx-js-style 추가)

## 비변경 (의도적으로 건드리지 않음)
- 대시보드 export (`dashboardExport.ts`) — 사용자가 My Workspace export만 요청
- TaskTable의 필터 로직, UI
