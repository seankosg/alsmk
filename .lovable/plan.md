

# PPT 보고서 — 차트 캡처 + 섹션 선택 기능

## 핵심 아이디어
대시보드의 Recharts 차트를 **html2canvas**로 캡처하여 이미지로 PPT에 삽입합니다. 내보내기 전에 다이얼로그에서 포함할 섹션을 선택할 수 있습니다.

## 대시보드 섹션 목록 (선택 가능)

| 섹션 | 유형 | PPT 반영 방식 |
|------|------|--------------|
| Milestone Timeline | 카드/타임라인 | 화면 캡처 → 이미지 |
| Project HUD (KPI + 도넛차트) | 차트 + 수치 | 화면 캡처 → 이미지 |
| Team Progress Chart | BarChart | 화면 캡처 → 이미지 |
| Category Progress Chart | BarChart | 화면 캡처 → 이미지 |
| Behind Schedule Board | 테이블 | 화면 캡처 → 이미지 |
| Critical Issue Board | 테이블 | 화면 캡처 → 이미지 |
| Upcoming Deadlines | 리스트 | 화면 캡처 → 이미지 |
| Issue Trend Chart | BarChart | 화면 캡처 → 이미지 |
| Team Heatmap | 히트맵 그리드 | 화면 캡처 → 이미지 |
| Part Status Board | 테이블 | 화면 캡처 → 이미지 |

## 구현 계획

### 1. 섹션 선택 다이얼로그 생성
**`src/components/dashboard/ExportReportDialog.tsx`**

- 체크박스 목록으로 포함할 섹션 선택 (기본: 전체 선택)
- "Excel" / "PowerPoint" 탭 또는 버튼으로 형식 선택
- "Export" 버튼 클릭 시 내보내기 실행

### 2. 각 대시보드 컴포넌트에 `data-export-id` 속성 추가
**`src/pages/Index.tsx`** — 각 섹션을 `<div data-export-id="team-progress">` 등으로 감싸기

```text
<div data-export-id="milestone-timeline">
  <MilestoneTimeline />
</div>
<div data-export-id="project-hud">
  <ProjectHUD />
</div>
...
```

### 3. html2canvas로 차트 캡처 후 PPT 생성
**`src/lib/dashboardExport.ts`** 수정

- `exportDashboardPptx(selectedSections)` 로 변경
- 선택된 섹션별로 `document.querySelector([data-export-id="..."])` → `html2canvas()` → base64 PNG
- 각 캡처 이미지를 슬라이드에 삽입 (1~2개씩 배치)
- 타이틀 슬라이드는 기존 데이터 기반 KPI 표 유지
- 나머지 슬라이드: 섹션 제목 + 캡처 이미지

### 4. PPT 슬라이드 구성

```text
Slide 1: 타이틀 + KPI 요약 (기존 데이터 기반)
Slide 2~N: 선택된 섹션별 캡처 이미지
  - 큰 차트: 1개/슬라이드 (전체 너비)
  - 작은 카드 2개: 좌우 배치 가능
```

### 5. 패키지 추가
- `html2canvas` (신규 설치)

### 6. UI 흐름

```text
Export Report 버튼 → ExportReportDialog 열림
  ☑ Milestone Timeline
  ☑ Project HUD
  ☑ Team Progress Chart
  ☑ Category Progress Chart
  ...
  [Excel] [PowerPoint]  ← 클릭 시 내보내기 실행
```

### 7. Index.tsx 변경
- 기존 DropdownMenu → ExportReportDialog 호출로 변경
- 각 컴포넌트를 `data-export-id` wrapper로 감싸기

## Technical Notes
- html2canvas는 DOM 요소를 캔버스로 렌더링하여 PNG로 변환
- 다크모드 상태 그대로 캡처됨 (사용자가 보는 것과 동일)
- 캡처 시 잠시 로딩 상태 표시 (순차 캡처)
- Excel 내보내기는 기존 데이터 기반 방식 유지 (차트 캡처 불필요)

