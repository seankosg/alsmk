## 변경 요청 정리

1. **Sticky 컬럼 확장**: 좌측 고정 영역을 `Progress Status` 전체 12열까지 확장
   - 고정 컬럼: `Block` · `Team` · `Disc.` · `Total DWG`(SD/DD/CD 3열) · `Progress Status` 전체 12열 (Overall 3 + SD Stage 3 + DD Stage 3 + CD Stage 3) = **총 18열**
   - 우측 스크롤 영역: SD/DD/CD 단계 펼침 시 노출되는 마일스톤 상세 컬럼들

2. **SD/DD/CD Stage 펼침/접힘 기본값 변경**
   - 현재: 세 단계 모두 접힘
   - 변경: **DD만 펼침**, SD/CD는 접힘 (`{ SD: false, DD: true, CD: false }`)
   - 토글 동작 자체는 그대로 유지

3. **Block/Team rowSpan 셀 병합 유지** (해제하지 않음)

## 구현 방법 (기술 상세)

### A. Sticky 누적 left 오프셋 계산
- `colStyle(key)`가 반환하는 `width`를 기반으로 18개 고정열의 **누적 left 값**을 `useMemo`로 계산
- 각 고정 컬럼 키 순서를 배열로 정의:
  ```
  ["__block","__team","__disc",
   "dwg-SD","dwg-DD","dwg-CD",
   "op-OVERALL-P","op-OVERALL-A","op-OVERALL-D",
   "op-SD-P","op-SD-A","op-SD-D",
   "op-DD-P","op-DD-A","op-DD-D",
   "op-CD-P","op-CD-A","op-CD-D"]
  ```
- 각 키의 너비(없으면 `DEFAULT_COL_W=56`, Block/Team/Disc는 별도 고정 폭 상수 — 예: 110/90/70)를 누적 → `leftOffset[key]`
- 헬퍼 `stickyStyle(key)`: `{ position:"sticky", left: leftOffset[key], zIndex, background }` 반환

### B. thead/tbody 모든 해당 셀에 sticky 적용
- **1단 헤더** (`Block`/`Team`/`Disc.` rowSpan=3, `Total DWG` colSpan=3, `Progress Status` colSpan=12): rowSpan/colSpan을 가진 셀도 sticky 가능 → 각 셀에 `stickyStyle`의 left 값 적용 (colSpan 셀은 가장 좌측 컬럼의 left 사용)
- **2단/3단 헤더**: 해당 18개 컬럼에 sticky 적용
- **tbody `<td>`**: rowSpan을 가진 Block/Team 셀 포함, 18개 고정 컬럼 모두 sticky 적용 + 행 배경(`bg-background` / 합계행 배경)을 명시해 스크롤 시 가려지지 않도록
- z-index 계층: 헤더 sticky(20) > 본문 sticky(10) > 일반 셀

### C. 우측 경계선
- 18번째 컬럼(`op-CD-D`)의 우측에 `border-r` 강조 + `box-shadow: inset -1px 0 0` 또는 `shadow-[2px_0_4px] ` 로 스크롤 경계 시각화

### D. expanded 기본값 변경
- `useState<Record<MdrStage,boolean>>({ SD:false, DD:true, CD:false })`

## 영향/주의

- **가시 영역**: 현재 미리보기 폭(995px CSS px)에서 sticky 18열 합계가 약 1,000px 이상이 될 수 있어, 마일스톤 상세 컬럼을 보려면 가로 스크롤 거의 전체가 필요합니다. 좁은 화면에선 사실상 우측 영역이 거의 안 보일 수 있음.
- **rowSpan + sticky 호환성**: 최신 Chromium/Safari/Firefox에서 동작. `border-collapse: collapse`인 현재 테이블에서도 sticky는 작동하지만 셀 border가 스크롤 시 일부 사라져 보일 수 있어 background는 반드시 셀별로 지정.
- 컬럼 너비 리사이즈(ResizeHandle)에 따라 누적 offset이 즉시 재계산되도록 `columnWidths` 의존성에 연결.

## 변경 파일

- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` (단일 파일)
