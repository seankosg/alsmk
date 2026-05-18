## XML Upsert + Orphan 매핑 복구 통합 계획

CPM Manager의 XML 업로드/재계산 흐름 전반과 Orphan 매핑 복구 센터를 함께 정비합니다. 핵심 목표는 **(1) 안전한 신규 XML upsert 절차 마련**, **(2) 일반 사용자의 CPM 변경 차단**, **(3) Orphan 관리·복구의 일원화**입니다.

---

### Part A. 신규 XML Upsert 안전 절차

#### A-1. 업로드 전 자동 백업 (롤백 보장)
- 신규 XML 업로드 직전 `cpm_snapshots`에 `auto_pre_upload_{YYYYMMDD_HHmm}` 이름으로 자동 스냅샷 생성
- `data` JSONB에 현재 활성 네트워크 + 전체 task mappings 저장
- SnapshotManager에서 "업로드 직전 자동 백업" 배지로 시각 구분
- 사용자가 "되돌리기" 버튼 한 번으로 직전 상태 복원 (기존 snapshot-restore 흐름 재사용)

#### A-2. Upsert 단계 (현재 흐름 정리·유지)
```text
1) Pre-Backup           → cpm_snapshots 자동 INSERT
2) Parse XML (iframe)   → cpm-calculated postMessage
3) upsertActivities     → mpp_uid UNIQUE 기반 INSERT/UPDATE
4) Auto-Migrate         → semantic_key(BLDG::WBS_L2::Name) 일치 시 매핑 자동 이전
5) Orphan Detection     → 새 XML에 없는 mpp_uid 추출
   ├─ 매핑 0개 → auto_deleted_no_mappings 로그 후 즉시 삭제
   └─ 매핑 ≥1개 → OrphanResolutionDialog 즉시 표시 (기존 유지)
6) Snapshot Save        → 새 상태로 cpm_snapshots INSERT
```

#### A-3. 롤백 UX
- SnapshotManager 상단에 "직전 업로드 되돌리기" 단일 버튼 추가
- 클릭 시 가장 최근 `auto_pre_upload_*` 스냅샷을 "그래프 + 매핑 복원" 모드로 적용
- 확인 다이얼로그: "현재 활성 CPM과 매핑을 직전 업로드 이전 상태로 되돌립니다"

---

### Part B. 일반 사용자 접근 제한 (검증 모드)

#### B-1. 전역 플래그
- `project_settings`에 `cpm_locked = 'true' | 'false'` 키 추가
- Admin Settings 페이지에 토글: "CPM 검증 모드 (Admin/PM만 매핑·업로드 가능)"

#### B-2. 잠금 시 동작
| 대상 | 잠금 동작 |
|---|---|
| CPM Manager 라우트 | Admin/PM만 진입, 외 사용자는 "검증 중" 안내 화면 |
| iframe XML 업로드/계산 | `set-read-only` 메시지로 차단 (기존) |
| ActivityTaskPanel MapTasksDialog | 버튼 숨김 (기존) |
| TaskDetailDialog MapActivitiesDialog | 버튼 숨김 (신규 추가) |
| 사이드바 CPM Manager 메뉴 | Guest/일반 사용자에게 숨김 |

#### B-3. 잠금 해제 시
- Admin이 토글 OFF → 모든 사용자 정상 사용 가능
- 변경은 `activity_log`에 `cpm_lock_toggled` 기록

---

### Part C. Orphan 매핑 복구 센터 (`/cpm/orphans`)

#### C-1. 위치 / 접근 제어
- 별도 라우트 `/cpm/orphans`, 사이드바 "CPM Manager" 아래 "Orphan Center"
- `isAdminOrPm`만 접근, 외 사용자는 `/`로 리다이렉트

#### C-2. 화면 구성
```text
┌─ 요약 카드 ─────────────────────────────────────┐
│ 미해결 Orphan │ 자동 복구된 매핑 │ 자동 삭제된 행 │
└─────────────────────────────────────────────────┘

┌─ 탭 1: 미해결 Orphan ───────────────────────────┐
│ [추천 자동 적용 (100점만)] [선택 삭제]          │
│ ☐ Orphan명 │ BLDG │ WBS L2 │ 매핑수 │ 추천 대상 │ 점수 │
└─────────────────────────────────────────────────┘

┌─ 탭 2: 자동 삭제 이력 (최근 50건) ──────────────┐
│ 이름 │ BLDG │ WBS │ 삭제 시각 │ 처리자 │ [현재 그래프에서 찾기] │
└─────────────────────────────────────────────────┘
```

#### C-3. 추천 점수 (`OrphanRecommender.ts`)
- 100점: BLDG + WBS L2 + Name 완전 일치 → **일괄 자동 적용 대상**
- 80점: BLDG + Name 일치
- 60점: Name 일치
- 40점: BLDG + Name Levenshtein ≤ 3
- 0점: 매칭 없음

"추천 자동 적용" 버튼은 **100점만** 일괄 처리.

#### C-4. 일괄 복구 로직 (`bulkResolveOrphans`)
각 Orphan을 순차 처리:
1. 선택된 추천 대상의 기존 매핑과 merge → `upsert_activity_mappings` RPC
2. Orphan의 `cpm_task_mappings` 삭제 → `cpm_activities` 삭제
3. `activity_log`에 `resolution: 'migrated'` 또는 `'deleted'` 기록

#### C-5. 자동 삭제 이력 의미
- Phase 5에서 매핑이 0개인 Orphan은 즉시 삭제 + `auto_deleted_no_mappings` 로그
- 복원 버튼 없음 (매핑 자체가 없음)
- **"현재 그래프에서 찾기"** 버튼: semantic_key로 활성 CPM 검색 → 발견 시 `/cpm?highlight={mpp_task_id}`로 이동하여 즉시 매핑 가능

#### C-6. 데이터 소스
- 미해결 Orphan: `cpm_activities` LEFT JOIN `cpm_task_mappings` ─ 현재 활성 mpp_uid set에 없는 행
- 활성 mpp_uid set: CpmScheduler iframe에 `request-active-mpp-uids` postMessage → 응답으로 수신
- 자동 삭제 이력: `activity_log` WHERE `action='cpm_activity_deleted'` AND `details.resolution='auto_deleted_no_mappings'` ORDER BY `created_at DESC` LIMIT 50

---

### Part D. 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `src/pages/CpmOrphanCenter.tsx` | 신규 (Orphan 센터 페이지) |
| `src/components/cpm/OrphanRecommender.ts` | 신규 (추천 점수 순수 함수) |
| `src/pages/CpmScheduler.tsx` | (1) 업로드 직전 auto pre-backup 추가, (2) `request-active-mpp-uids` 핸들러 추가, (3) `cpm_locked` 체크 |
| `src/components/cpm/SnapshotManager.tsx` | "직전 업로드 되돌리기" 버튼 + auto_pre_upload 배지 |
| `src/components/admin/AdminSettings.tsx` | CPM 검증 모드 토글 |
| `src/components/tasks/TaskDetailDialog.tsx` | MapActivitiesDialog 버튼 `isAdminOrPm && !cpmLocked` 가드 |
| `src/App.tsx` | `/cpm/orphans` 라우트 추가 |
| `src/components/layout/AppSidebar.tsx` | Orphan Center 메뉴 + cpm_locked 시 일반 사용자 CPM 메뉴 숨김 |
| `src/hooks/useCpmLockStatus.ts` | 신규 (project_settings 조회 훅) |
| `.lovable/memory/features/cpm-integration.md` | XML upsert / Orphan Center / 검증 모드 메모 추가 |

DB 변경 없음 (project_settings는 기존 테이블, snapshot은 기존 흐름 활용).

---

### Part E. 안전 장치
- 일괄 작업 전 확정 다이얼로그 ("N건의 매핑을 이전합니다")
- 처리 중 상태 표시 + 중복 클릭 방지
- 실패 항목은 토스트로 개별 알림하고 목록에 남김
- 모든 액션은 `activity_log`에 `user_name`과 함께 기록
- 검증 모드 ON일 때 일반 사용자가 CPM 직접 URL 접근 시 차단 안내
