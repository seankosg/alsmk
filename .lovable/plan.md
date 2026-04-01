

# 스냅샷 복원으로 매핑 데이터까지 복원되는가? — 분석 결과

## 결론: **아니오, 완벽히 복원되지 않습니다.**

스냅샷은 **CPM 네트워크 그래프(시각적 구조)**만 저장하며, **Task 매핑(`cpm_task_mappings`)은 포함되지 않습니다.**

---

## 현재 스냅샷이 저장하는 것

| 데이터 | 포함 여부 |
|--------|-----------|
| Activity 목록 (이름, WBS, 기간, 선행관계 등) | ✅ |
| 날짜 (ES/EF/LS/LF, 시작/종료) | ✅ |
| 진행률, Critical Path, 링크 타입/Lag | ✅ |
| WBS 이름, 필터, 프로젝트 시작일 | ✅ |
| Custom Fields | ✅ |
| **cpm_task_mappings (Activity↔Task 매핑)** | ❌ |
| **cpm_activities DB 행 (ID 등)** | ❌ |

## 새 XML 업로드 시 벌어지는 일

```text
1. 새 XML 업로드 → upsertActivities(isNewImport: true)
2. 새 activity rows가 DB에 upsert (mpp_uid 기준)
3. 구 activity 중 새 XML에 없는 것 → 고아(orphan) 판정
4. 고아의 매핑 → 시맨틱 키 일치 시 자동 이전, 불일치 시 OrphanResolutionDialog
5. 미해결 고아 → 삭제 (CASCADE로 매핑도 삭제)
```

이 과정에서 **매핑이 이미 삭제/이전된 후**이므로, 스냅샷을 로드해도:
- iframe의 그래프 구조만 옛 상태로 복원됨
- DB의 `cpm_activities`는 새 XML 기준 행이 그대로 유지
- `cpm_task_mappings`는 이미 변경/삭제된 상태 — 복원 불가

## 해결 방안

스냅샷 저장 시 **매핑 데이터를 함께 저장**하고, 복원 시 **매핑도 함께 복원**하는 기능 추가가 필요합니다.

### 변경 내용

**1. 스냅샷 저장 시 매핑 포함** (`src/pages/CpmScheduler.tsx`)
- `saveSnapshotToDb` 호출 전, `cpm_task_mappings` 전체를 조회
- `cpm_activities`의 `mpp_uid → id` 매핑도 조회
- 스냅샷 JSONB `data`에 `taskMappings` 필드 추가: `[{ mpp_uid, task_ids[] }]` 형태

**2. 스냅샷 복원 시 매핑 복원** (`src/pages/CpmScheduler.tsx`)
- `handleLoadSnapshot`에서 `snapshot.data.taskMappings` 존재 시:
  - 현재 DB의 `cpm_activities`에서 `mpp_uid → id` 조회
  - 기존 매핑 전체 삭제 후, 스냅샷의 매핑 데이터로 재삽입
- 복원 완료 후 `refreshStatus()` 호출

**3. 복원 확인 다이얼로그** (선택사항)
- "매핑 데이터도 함께 복원하시겠습니까?" 확인 팝업 추가
- 그래프만 복원 / 그래프+매핑 복원 선택 가능

### 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | 저장 시 매핑 포함, 복원 시 매핑 재삽입 |

DB 마이그레이션은 불필요 (`cpm_snapshots.data`가 JSONB이므로 필드 추가 자유)

