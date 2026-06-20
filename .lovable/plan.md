## 진단 결과
Raw Data 건물: **SMP&CCM(914), HSM(585), CRM(1934), MAIN_OFFICE(139), FAFP(84)** — 총 5개.
Summary 패널 코드는 5개 블록을 모두 `summary.blocks.map`으로 렌더링하고 있습니다. **누락이 아니라 페이지 스크롤 아래에 가려진 상태**입니다. (AppLayout main이 `overflow-auto`)

요구사항: **세로 스크롤 없이 Block × Discipline × Stage 매트릭스를 한 화면에 표시**.

## 변경 사항

### 1. 매트릭스 압축 (`MdrSummaryPanel.tsx`)
현재 5블록 × 평균 5분야 + Sub-total = 약 30행 → 한 화면에 맞추려면 행 높이 압축이 필요.

- **행 높이 축소**: `py-1` → `py-0.5`, 폰트 `text-xs` → `text-[11px]`
- **Sub-total 행 제거**: Block 셀(rowSpan)에 Block Progress·총 DWG를 묶어 표기. 별도 합계행 없앰
- **DWG·SD·DD·CD 묶음**: SD/DD/CD 각각 Plan/Actual/% 3열 → `Actual/Plan (%)` 단일 셀로 통합 (예: `225/225 (4.3%)`). 헤더 두 번째 줄 제거 → 헤더 1행
- **GEN/FAFP처럼 합산 제외 블록**: 마지막에 정렬, 옅게(`opacity-50`) 유지

결과 예상: 헤더 1행 + 약 25 disc 행 ≈ 26행 × ~24px = ~620px → 995×771 뷰포트 안에 맞음.

### 2. 컨테이너 높이 고정
- Card 안 table 래퍼: `overflow-auto` 제거, 자연 높이 사용
- 페이지 컨테이너에 `min-h-0` 보장 (필요 시)
- WF Collapsible 카드는 기본 접힘 유지 (현재 그대로)

### 3. 가로 스크롤만 유지
가로는 컬럼이 많아 좁은 뷰포트에서 필요. `overflow-x-auto`만 명시.

## 범위 외
- 페이지 자체의 `overflow-auto`(AppLayout)는 건드리지 않음 — 다른 페이지 영향 없게 유지
- 매트릭스 외 영역(헤더, WF 패널)은 변경 없음

## 기술 노트
- `MdrSummaryPanel.tsx`만 수정
- 셀 표기: `{actual}/{plan} ({pct}%)`, plan=0이면 `-`
- Block 셀에 `rowSpan={cells.length}` (Sub-total 행 제거에 맞춰)
