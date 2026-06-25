## 1. Summary 패널 삭제
- `src/pages/DesignSummary.tsx`에서 `MdrSummaryPanel` import 및 사용 제거
- `src/components/mdr/MdrSummaryPanel.tsx` 파일 삭제

## 2. Weight Factor 패널 이동
- `src/pages/DesignSummary.tsx`에 `MdrWeightsEditor` import 추가, `MdrMilestoneMonitorPanel` 아래에 배치

## 3. DesignManagement admin 탭 삭제
- `src/pages/DesignManagement.tsx`에서 `admin` `TabsTrigger` 및 `TabsContent` 제거
- `MdrWeightsEditor` import 제거

## 결과
- **Design Summary 페이지**: Milestone 테이블 → Weight Factor 편집기
- **Design Management 페이지**: admin 탭 제거 (Weight Factor는 Design Summary에서만 접근)

## 파일
- `src/pages/DesignSummary.tsx` (수정)
- `src/pages/DesignManagement.tsx` (수정)
- `src/components/mdr/MdrSummaryPanel.tsx` (삭제)
