

# Dashboard Report Export (Excel + PPT)

## Overview
대시보드의 주요 데이터를 **Excel (.xlsx)** 보고서와 **PowerPoint (.pptx)** 슬라이드로 내보내는 기능을 구현합니다. 대시보드 상단에 "Export" 드롭다운 버튼을 추가하여 두 형식 중 선택할 수 있게 합니다.

## 보고서 포함 내용

| Section | Excel Sheet | PPT Slide |
|---------|------------|-----------|
| Project Summary | 전체 진행률, Plan vs Actual, 완료/진행/미착수 수 | Slide 1: 제목 + 요약 KPI |
| Milestone Timeline | 마일스톤 목록 (이름, 날짜, 상태, D-Day) | Slide 2: 마일스톤 표 |
| Team Progress | 팀별 Plan vs Actual % | Slide 3: 팀별 진행률 표 |
| Behind Schedule | 지연 태스크 목록 (담당자, 제목, gap%) | Slide 4: 지연 태스크 표 |
| Critical Issues | 이슈 태스크 목록 | Slide 5: 이슈 태스크 표 |

## 구현 계획

### 1. Export 유틸리티 파일 생성
**`src/lib/dashboardExport.ts`** — 데이터 수집 및 내보내기 로직

- `exportDashboardExcel()`: xlsx 라이브러리로 시트별 데이터 작성
- `exportDashboardPptx()`: pptxgenjs 라이브러리로 슬라이드 생성

두 함수 모두 Supabase에서 tasks, teams, milestones를 조회하여 가공합니다.

### 2. Export 버튼 추가
**`src/pages/Index.tsx`** — 대시보드 헤더에 드롭다운 메뉴 추가

```text
[Project Dashboard]          [▼ Export Report]
                              ├─ Excel (.xlsx)
                              └─ PowerPoint (.pptx)
```

### 3. 패키지 설치
- `xlsx` (이미 설치됨 — Workspace 내보내기에서 사용 중)
- `pptxgenjs` (신규 설치 필요)

### 4. Excel 상세 구조
- **Sheet 1 "Summary"**: 전체 태스크 수, 완료/진행/미착수, 평균 Plan%, 평균 Actual%, Gap%
- **Sheet 2 "Milestones"**: name, target_date, status, D-Day
- **Sheet 3 "Team Progress"**: 팀명, 태스크 수, 평균 Plan%, 평균 Actual%, Gap%
- **Sheet 4 "Behind Schedule"**: 지연 태스크 상세 (task_code, title, assignee, plan%, actual%, gap%)
- **Sheet 5 "Critical Issues"**: 이슈 태스크 상세

### 5. PPT 상세 구조
- **Slide 1**: 타이틀 슬라이드 — "ALSMK Project Report" + 날짜 + KPI 요약 (총 태스크, 평균 진행률, Gap)
- **Slide 2**: 마일스톤 타임라인 표
- **Slide 3**: 팀별 진행률 표 (색상 코딩)
- **Slide 4**: 지연 태스크 목록 표
- **Slide 5**: 이슈 태스크 목록 표

Hyundai E&C 브랜드 컬러 (dark navy/blue) 기반 디자인 적용.

## Technical Notes
- 두 내보내기 함수 모두 클라이언트 사이드에서 실행 (Supabase SDK로 데이터 조회)
- `calcPlannedProgress` 재사용하여 Plan% 계산
- 파일명: `ALSMK_Report_YYYY-MM-DD.xlsx` / `.pptx`
- 로딩 상태 표시 (toast)

