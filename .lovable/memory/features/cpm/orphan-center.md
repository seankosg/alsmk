---
name: CPM Orphan Center
description: Task 중심 Orphan 재매핑 UI, 추천 점수 체계, NewActivityCombobox, 자동 삭제 이력 네비게이션
type: feature
---

## 관점
- 행 단위 = "갈 곳 잃은 Task 1건" (Activity 단위 아님)
- Orphan Activity는 출처 정보로만 표시 (BLDG · WBS_L2 · Name · mpp_uid)
- 동일 UX를 메인 페이지(`CpmOrphanCenter.tsx`)와 업로드 직후 다이얼로그(`OrphanResolutionDialog.tsx`) 양쪽에 적용

## 화면 구성
- 2개 탭: "미해결 Task" / "자동 삭제 이력"
- 컬럼: [체크박스] · Orphan Activity · 기존 매핑 Task · NewActivityCombobox · 적용
- 일괄 액션: 선택 일괄 적용 / 선택 매핑 해제 / 추천 95점↑ 일괄 적용

## 추천 점수 (`OrphanRecommender.ts`)
- 100점: BLDG + WBS_L2 + Name 완전 일치 (자동 적용, Orphan Center 노출 X)
-  95점: BLDG + Name 일치 (WBS 변경)
-  80점: WBS_L2 + Name 일치 (BLDG 누락/변경)
-  60점: Name 일치
-  50점: BLDG + WBS_L2 일치 + Name 접두/접미 (분할 추정)
- API: `recommendFor(orphan, candidates)` / `scoreCandidates(orphan, candidates, topK=3)`

## NewActivityCombobox (`src/components/cpm/NewActivityCombobox.tsx`)
- shadcn Command + Popover
- 구역: ── 추천 (점수 배지) ── 전체 (fuzzy 검색) ── 기타 ("매핑 해제")
- value=null → 매핑 해제, undefined → 추천 1순위 자동 채움

## 재매핑 로직 (`remapTask`)
1. orphan에서 해당 task_id 매핑 삭제
2. targetId 있으면 `upsert_activity_mappings`로 신규 Activity에 추가 (중복 제거)
3. `activity_log` INSERT (action: `cpm_task_remapped`)
4. orphan 매핑 0개 남으면 `cpm_activities` DELETE + 자동 삭제 로그

## 자동 삭제 이력 네비게이션
- "현재 그래프에서 찾기" → `/cpm?highlight={mpp_task_id}`
- CpmScheduler가 ?highlight= 쿼리 파라미터를 캡처해 pendingHighlight state에 저장 후 URL clear

## SnapshotManager Quick Restore
- 상단 "직전 업로드 되돌리기 (MM-dd HH:mm)" 버튼
- 가장 최근 `auto_pre_upload_*` 스냅샷을 그래프+매핑 모드로 1클릭 복원
