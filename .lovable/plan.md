## XML Upsert + Orphan 매핑 복구 통합 계획 (전체 재정리)

### 진행 현황 한눈에 보기

| 영역 | 상태 |
|---|---|
| ✅ Part A. XML 업로드 직전 자동 백업 + SnapshotManager 배지 | 구현 완료 |
| ✅ Part B. CPM 검증 모드 (Lock 토글, 사이드바/라우트/매핑 버튼 가드) | 구현 완료 |
| ✅ Part C. Orphan Center 기본 페이지 + 자동 삭제 이력 탭 | 구현 완료 |
| 🔄 **Part D. Orphan Center를 Task 중심 테이블로 전면 재설계** | **이번에 진행** |
| 🔄 **Part E. 자동 삭제 이력 "현재 그래프에서 찾기" 동작 강화** | **이번에 진행** |
| 🔄 **Part F. 직전 업로드 되돌리기 단일 버튼 (SnapshotManager 보강)** | **이번에 진행** |
| 🔄 **Part G. Activity Combobox 신규 (텍스트 검색 + 추천 + 풀다운)** | **이번에 진행** |
| 🔄 **Part H. 메모리/문서 업데이트** | **이번에 진행** |

---

### Part D. Orphan Center — Task 중심 매핑 복구 (전면 재작성)

#### D-1. 관점 전환
- 기존: "사라진 Orphan Activity 1개"가 행 단위 → 매핑된 Task가 보이지 않아 판단 불가
- 신규: **"갈 곳을 잃은 Task 1건"이 행 단위**, Orphan Activity는 출처 정보로만 표시

#### D-2. 화면 구조

```text
┌─ 상단 카드 ──────────────────────────────────────────────────┐
│ 갈 곳 잃은 Task 27건 │ 영향 Orphan Activity 8건 │ 자동 삭제 50건 │
└─────────────────────────────────────────────────────────────┘

[탭 1] 미해결 Task        [탭 2] 자동 삭제 이력

┌─ 미해결 Task 테이블 ─────────────────────────────────────────────────────────────┐
│ ☐ │ Orphan Activity (WBS · 전체이름)  │ 기존 매핑 Task        │ 신규 Activity 선택       │ 적용 │
├───┼──────────────────────────────────┼──────────────────────┼──────────────────────────┼──────┤
│ ☐ │ 1.2.3 · A동/지하1층/거푸집        │ HDEC-CIV-2501-0012   │ [B1F 거푸집 설치 ▼]🔍   │ [✓]  │
│   │ mpp_uid 1234                     │ 거푸집 자재 반입       │ 추천 95점               │      │
│   │                                  │ 홍길동 · 60%          │                          │      │
├───┼──────────────────────────────────┼──────────────────────┼──────────────────────────┼──────┤
│ ☐ │ 1.3.0 · B동/철근배근              │ HDEC-CIV-2501-0021   │ [선택하세요 ▼]🔍       │ [✓]  │
│   │ mpp_uid 5500 (분할 추정)          │ 철근 검측 요청 🚩     │ 후보: A/B/C동           │      │
└──────────────────────────────────────────────────────────────────────────────────┘

[선택 일괄 적용] [선택 매핑 해제] [추천 95점 이상 일괄 적용]
```

**컬럼 명세**:
1. **체크박스** — 다중 선택용
2. **Orphan Activity** — WBS 전체경로 + BLDG/WBS_L2/Name 조합 + mpp_uid
3. **기존 매핑 Task** — Task Code · 제목 · 담당자 · 진척 · 이슈 플래그 (클릭 → Workspace 딥링크)
4. **신규 Activity 선택 (`NewActivityCombobox`)**:
   - 기본값: 추천 1순위 자동 채움 (점수 배지)
   - 풀다운: 활성 Activity 전체 목록 (`BLDG · WBS_L2 · Name` 형식)
   - 🔍 텍스트 검색: 이름/WBS/BLDG fuzzy 필터링
   - "매핑 해제" 옵션 포함
5. **적용 버튼** — 행 단위 즉시 처리

**일괄 액션 푸터**:
- 선택 일괄 적용 / 선택 매핑 해제 / 추천 95점 이상 자동 처리

#### D-3. 추천 로직 보강 (`OrphanRecommender.ts`)
```text
100점: BLDG + WBS_L2 + Name 완전 일치
 95점: BLDG + Name 일치 (WBS 변경)
 80점: WBS_L2 + Name 일치 (BLDG 누락)
 60점: Name 일치
 50점: BLDG + WBS_L2 일치 + Name 접두/접미 포함 (분할)
  0점: 매칭 없음
```
`scoreCandidates(orphan, allNewActivities)` → 상위 3개 반환.

#### D-4. 행 단위 처리 (`applyTaskRemap`)
```text
1. target_activity_id의 기존 매핑 조회
2. task_id merge (중복 제거)
3. upsert_activity_mappings(target_activity_id, merged_task_ids)
4. orphan_activity의 cpm_task_mappings에서 해당 task_id만 제거
5. activity_log INSERT (action: cpm_task_remapped, from/to/task_code)
6. orphan_activity 매핑 0개 → cpm_activities 자동 삭제 + 로그
```

#### D-5. 데이터 페치 (`useOrphanTasks`)
- 활성 mpp_uid set: `request-active-mpp-uids` postMessage (CpmScheduler ↔ Orphan Center)
- Orphan 조인 쿼리: `cpm_activities ⋈ cpm_task_mappings ⋈ tasks ⋈ members` (Task 평탄화)
- 활성 Activity 목록: 콤보박스용 전체 페치 (`.limit(5000)`)

---

### Part E. 자동 삭제 이력 탭 강화

이미 페이지는 존재하지만 다음을 보강:
- **"현재 그래프에서 찾기"** 버튼: `semantic_key` 또는 `mpp_task_id`로 활성 CPM 검색
  - 발견 시 → `/cpm?highlight={mpp_task_id}` 라우팅
  - CpmScheduler가 query param 받아 iframe에 `highlight-node` postMessage 전달
- 표시 컬럼: 이름 · BLDG · WBS · 삭제 시각 · 처리자 · 액션
- 정렬: `created_at DESC LIMIT 50`

---

### Part F. SnapshotManager — 직전 업로드 되돌리기

- 상단에 단일 버튼 **"직전 업로드 되돌리기"** 추가
- 가장 최근 `auto_pre_upload_*` 스냅샷을 "그래프 + 매핑 복원" 모드로 호출
- 확인 다이얼로그: "현재 활성 CPM과 매핑을 직전 업로드 이전 상태로 되돌립니다. 진행할까요?"
- 기존 snapshot-restore 흐름 재사용 (신규 코드 최소화)

---

### Part G. NewActivityCombobox (재사용 컴포넌트)

`src/components/cpm/NewActivityCombobox.tsx` 신규:
- shadcn Command + Popover 조합
- props: `value`, `onChange`, `candidates`, `recommendations` (상위 3개)
- 표시 구조:
  ```
  ── 추천 ──
  • B1F 거푸집 설치 (95점)
  • 지하1층 거푸집 마감 (80점)
  ── 전체 ──
  • 검색창 (입력 시 fuzzy 필터)
  • A동/1.2.3/거푸집 자재 반입
  • ...
  ── 기타 ──
  • 매핑 해제
  ```
- Orphan Center 메인 테이블에서 행마다 1개씩 사용

---

### Part H. 메모리/문서 업데이트

- `.lovable/memory/features/cpm-integration.md` — Orphan Center Task 중심 구조, 점수 체계, postMessage 추가 항목 기록
- `mem://features/cpm/orphan-center` 신규 또는 기존 통합 — index.md 갱신

---

### Part I. 파일 변경 요약 (이번 작업 분량)

| 파일 | 변경 |
|---|---|
| `src/pages/CpmOrphanCenter.tsx` | **전면 재작성** (Task 행 테이블 + 상단 카드 + 일괄 푸터 + 2개 탭) |
| `src/components/cpm/NewActivityCombobox.tsx` | **신규** (추천+검색+풀다운 콤보) |
| `src/components/cpm/OrphanRecommender.ts` | 점수 체계 보강, `scoreCandidates()` 추가 |
| `src/hooks/useOrphanTasks.ts` | **신규** (Task 평탄화 페치 + 활성 mpp_uid 동기화 + remap mutation) |
| `src/components/cpm/SnapshotManager.tsx` | "직전 업로드 되돌리기" 버튼 |
| `src/pages/CpmScheduler.tsx` | `request-active-mpp-uids` 응답 핸들러 + `?highlight=` 처리 |
| `src/components/cpm/OrphanResolutionDialog.tsx` | (업로드 직후) 동일 컬럼 구조로 정리 — UX 일관성 |
| `.lovable/memory/features/cpm-integration.md` | 변경 사항 기록 |

**DB 변경 없음** (기존 테이블·RPC 활용).

---

### Part J. 안전 장치

- 일괄 적용 전 확정 다이얼로그 ("Task N건을 'XXX'로 이전합니다")
- 행 단위 처리는 독립 — 일부 실패해도 나머지 진행, 실패 행은 빨간 표시
- 모든 액션 `activity_log`에 user_name + from/to + task_code 기록
- `upsert_activity_mappings` RPC 원자성으로 동시 편집 충돌 방지
- 검증 모드 ON 상태에서만 안전한 작업 권장 안내 배너
- 처리 중 행은 disabled + 스피너, 중복 클릭 차단

---

### Part K. 사용 시나리오

1. Admin이 새 XML 업로드 (자동 백업 생성 → 검증 모드 ON 권장)
2. Orphan Center 진입 → "갈 곳 잃은 Task 27건"
3. **"추천 95점 이상 일괄 적용"** 클릭 → 20건 자동 처리
4. 남은 7건: 콤보박스 검색/풀다운으로 신규 Activity 지정 → 행 단위 적용
5. 모든 매핑 완료 → 빈 Orphan은 자동 삭제
6. 자동 삭제 이력 탭에서 "현재 그래프에서 찾기"로 누락 점검
7. 검증 모드 OFF → 일반 사용자 공개
