## #4 메모리 문서 업데이트 + #5 OrphanResolutionDialog Task 중심 정리

### 작업 1 — `.lovable/memory/features/cpm-integration.md` 보강 (#4)

기존 "Orphan Migration (Phase 5)" 섹션 뒤에 **Phase 7** 섹션을 추가하여 Task 중심 Orphan Center 구조를 기록한다.

추가할 내용:

```text
## Orphan Center Task-Centered Redesign (Phase 7)
- CpmOrphanCenter.tsx 전면 재작성: Activity 단위가 아닌 "갈 곳 잃은 Task 1건"이 행 단위
- 행 구성: [체크박스] · Orphan Activity (BLDG · WBS_L2 · Name · mpp_uid) · 기존 매핑 Task (code/title/assignee/progress/issue) · NewActivityCombobox · 적용 버튼
- 2개 탭: "미해결 Task" / "자동 삭제 이력"
- 일괄 액션: 선택 일괄 적용 / 선택 매핑 해제 / 추천 95점 이상 일괄 적용

## Recommendation Scoring (OrphanRecommender.ts)
- 100점: BLDG + WBS_L2 + Name 완전 일치 (자동 적용, Orphan Center 노출 X)
-  95점: BLDG + Name 일치 (WBS 변경)
-  80점: WBS_L2 + Name 일치 (BLDG 누락/변경)
-  60점: Name 일치
-  50점: BLDG + WBS_L2 일치 + Name 접두/접미 (분할 추정)
-   0점: 매칭 없음
- API: `recommendFor(orphan, candidates)` (1순위) / `scoreCandidates(orphan, candidates, topK=3)` (상위 N)

## NewActivityCombobox (src/components/cpm/NewActivityCombobox.tsx)
- shadcn Command + Popover 기반 재사용 콤보
- props: value, onChange, candidates, recommendations
- 구역: ── 추천 (점수 배지) ── 전체 (fuzzy 검색) ── 기타 ("매핑 해제")
- Orphan Center 메인 테이블 + OrphanResolutionDialog 양쪽에서 사용

## Auto-Delete History Navigation
- 자동 삭제 이력 탭의 "현재 그래프에서 찾기" → /cpm?highlight={mpp_task_id} 라우팅
- CpmScheduler가 ?highlight= 쿼리 파라미터를 캡처해 pendingHighlight state에 저장 후 URL clear

## SnapshotManager Quick Restore
- 상단 "직전 업로드 되돌리기 (MM-dd HH:mm)" 버튼
- 가장 최근 auto_pre_upload_* 스냅샷을 그래프+매핑 모드로 1클릭 복원

## OrphanResolutionDialog (업로드 직후 다이얼로그) — Task 중심 통일
- 행 단위: Activity 그룹이 아닌 Task 단위 (메인 페이지와 동일 UX)
- 컬럼: Orphan Activity · 기존 매핑 Task · NewActivityCombobox · 적용
- 추천 1순위 자동 채움 (점수 배지), "매핑 해제" 선택 시 매핑만 제거
- 모든 Task 처리 완료 → Orphan Activity 자동 삭제
```

`mem://index.md`에도 신규 라인 1개 추가:
```
- [CPM Orphan Center](mem://features/cpm/orphan-center) — Task 중심 재매핑 UI, 추천 점수, NewActivityCombobox
```

추가 신규 메모리 파일 `mem://features/cpm/orphan-center` 작성 (frontmatter + 위 핵심 요약).

---

### 작업 2 — `OrphanResolutionDialog.tsx` Task 중심 재작성 (#5)

#### 현재 문제
- Activity 1행 = 1개 Select 드롭다운 → 매핑된 Task 자체가 보이지 않음
- 메인 Orphan Center는 이미 Task 중심인데 업로드 직후 다이얼로그만 구식 → UX 불일치

#### 새 구조

```text
┌─ Dialog (max-w-4xl, max-h-[80vh]) ─────────────────────────────────┐
│ Title: CPM Activity 매핑 확인                                       │
│ Desc:  새 XML에 없는 Activity의 Task N건을 재매핑하세요              │
│                                                                     │
│ ┌─ Task 행 (각 매핑된 Task별 1행) ─────────────────────────────────┐ │
│ │ Orphan Activity        │ 기존 Task          │ 신규 Activity  │적용│ │
│ │ [BLDG] L2 · Name       │ CODE · 제목        │ [Combobox▼]    │ ✓ │ │
│ │ mpp_uid 1234           │ 담당자 · 60% · 🚩  │ 추천 95점       │   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Footer:                                                             │
│  [추천 95점↑ 일괄 적용]  [선택 매핑 해제]  [완료]                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### 데이터 평탄화
- props `orphans`에는 `mappedTaskIds[]`가 있음 → `tasks` + `members` 조회로 Task 메타 보강
- 평탄화 결과: `Array<{ orphan, task, recommendations }>` (Task 단위 행)
- 추천: `scoreCandidates(orphan, newActivities, 3)` 사용

#### 행 단위 처리 `applyTaskRemap(orphan, task, targetActivityId | "unmap")`
1. `targetActivityId === "unmap"`: 해당 Task의 `cpm_task_mappings` row만 삭제
2. 신규 Activity 선택 시:
   - target Activity 기존 매핑 조회 → task_id merge
   - `upsert_activity_mappings(target, merged)`
   - orphan의 `cpm_task_mappings` 중 해당 task_id만 삭제 (다른 Task는 유지)
3. `activity_log` INSERT (`action: cpm_task_remapped`, details: from/to/task_code)
4. orphan Activity의 남은 매핑 0개 → `cpm_activities` DELETE + 로그

#### 일괄 액션
- **추천 95점 이상 일괄 적용**: 각 행의 추천 1순위 점수가 95점 이상이면 자동 처리
- **선택 매핑 해제**: 체크된 행들의 매핑만 제거 (orphan은 남김 → 마지막에 빈 orphan 정리)
- **완료**: 남은 미처리 행 경고 후 빈 orphan 자동 삭제

#### 재사용
- `NewActivityCombobox` 그대로 사용
- `OrphanRecommender.scoreCandidates` 그대로 사용
- 동일한 로직이 Orphan Center 페이지에도 있으므로 코드 중복은 함수 추출 없이 dialog 내에 인라인 (페이지 분리 권장 X, 다이얼로그는 1회성이라 가볍게 유지)

---

### 영향 파일

| 파일 | 변경 |
|---|---|
| `.lovable/memory/features/cpm-integration.md` | Phase 7 / Recommendation / NewActivityCombobox / Auto-Delete History / SnapshotManager Quick Restore / Dialog 통일 섹션 추가 |
| `.lovable/memory/features/cpm/orphan-center.md` | **신규** (요약 메모리) |
| `.lovable/memory/index.md` | Orphan Center 라인 추가 |
| `src/components/cpm/OrphanResolutionDialog.tsx` | **전면 재작성** (Task 행 + Combobox + 일괄 액션) |
| `src/pages/CpmScheduler.tsx` | OrphanResolutionDialog props 인터페이스 변화 시 호출부 정리 (기존 props 호환 유지 권장) |

### DB 변경
없음. 기존 RPC/테이블 그대로 사용.

### 검증
- 빌드 통과 확인
- 신규 XML 업로드 → 의도적으로 wbs 변경된 Activity 만들어 Dialog가 Task 단위로 표시되는지 시각 확인
- "매핑 해제" / 행 단위 적용 / 95점 일괄 적용 각 시나리오 동작 확인