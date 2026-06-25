## 목표
마일스톤 모니터링 패널의 표시 라벨과 내부 명칭을 일괄 변경합니다.

## 변경 내용

| 구분 | 변경 전 | 변경 후 |
|---|---|---|
| 패널 타이틀 | 마일스톤 모니터링 — Block × Discipline × Milestone | Design Progress Status |
| 패널 명칭(코드 주석/로딩 문구) | 마일스톤 모니터링 | Progress 패널 / 설계진도율 |

## 작업 파일
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` — 타이틀 및 로딩 문구 수정
- `src/lib/mdr/milestoneMonitorEngine.ts` — 파일 상단 주석 수정

## 참고
- 기능 및 산식 로직에는 변경 없음. UI 텍스트와 주석만 수정합니다.