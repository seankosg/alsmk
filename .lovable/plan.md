

# 신규 XML 업로드 시 매핑 자동이전 + Orphan 관리 + 삭제 로그

## 개요

새 XML 업로드 → CPM 계산 시 `upsertActivities` 로직을 3단계로 재구성합니다.

```text
Step 1: Upsert (현재와 동일)
Step 2: Orphan 식별 → name 매칭으로 매핑 자동이전
Step 3: 남은 orphan → 사용자에게 다이얼로그로 표시 → 수동 매핑이전 또는 삭제 선택
Step 4: 최종 삭제된 activity + 해제된 매핑을 activity_log에 기록
```

## 변경 파일

### 1. 새 컴포넌트: `src/components/cpm/OrphanResolutionDialog.tsx`

Orphan activity 목록을 보여주는 다이얼로그:
- 각 orphan에 대해: 이름, 매핑된 태스크 수 표시
- 각 orphan 행에 두 가지 액션:
  - **매핑이전**: 드롭다운으로 신규 activity 선택 → 해당 activity로 매핑 이전
  - **삭제**: orphan activity + 매핑 삭제
- 하단 "전체 삭제" 버튼 (남은 미처리 orphan 일괄 삭제)
- "완료" 버튼으로 다이얼로그 닫기

### 2. `src/pages/CpmScheduler.tsx` — `upsertActivities` 리팩토링

**Step 1: Upsert** (변경 없음)

**Step 2: Orphan 식별 + 자동 매핑이전**
```text
1. orphan activity 목록 조회 (DB에 있지만 새 XML에 없는 것)
2. 각 orphan의 매핑(cpm_task_mappings) 조회
3. 매핑이 있는 orphan에 대해:
   - 새 XML activity 중 같은 name을 가진 것을 찾음
   - 해당 신규 activity의 DB id 조회
   - 매핑의 activity_id를 신규 activity id로 UPDATE
   - 자동이전 성공 로그 (console + toast)
4. 매핑이 없는 orphan → 즉시 삭제 (영향 없음)
```

**Step 3: 남은 orphan 처리**
```text
- name 매칭 실패한 orphan 중 매핑이 있는 것 → OrphanResolutionDialog에 전달
- 다이얼로그에서 사용자가 수동으로 매핑이전 또는 삭제 결정
```

**Step 4: activity_log 기록**
```text
각 삭제된 orphan에 대해 activity_log에 INSERT:
- action: "cpm_activity_deleted"
- entity_type: "cpm_activity"
- entity_id: orphan activity id
- details: { name, wbs_full, mpp_task_id, unmapped_task_ids: [...], migrated_to: ... }
- user_name: 현재 사용자 이름
```

### 3. State 추가 (`CpmScheduler.tsx`)

```typescript
const [orphansToResolve, setOrphansToResolve] = useState<OrphanActivity[]>([]);
// OrphanActivity = { id, name, wbs_full, mpp_task_id, mappedTaskCount }
```

- `OrphanResolutionDialog`는 `orphansToResolve.length > 0`일 때 표시
- 새 activity 목록(드롭다운용)은 upsert 후 DB에서 조회한 최신 목록 사용

### 4. `OrphanResolutionDialog` 내부 로직

| 액션 | DB 처리 |
|------|---------|
| 매핑이전 (orphan → 신규 activity 선택) | `UPDATE cpm_task_mappings SET activity_id = 신규id WHERE activity_id = orphanId` → `DELETE cpm_activities WHERE id = orphanId` |
| 삭제 | `DELETE cpm_task_mappings WHERE activity_id = orphanId` → `DELETE cpm_activities WHERE id = orphanId` |

각 처리 후 `activity_log`에 기록.

### 5. Toast 알림

```text
- 자동이전 완료: "N개 Activity 매핑이 자동 이전되었습니다"
- Orphan 다이얼로그 표시 시: "M개 Activity의 매핑을 확인해주세요"
- 삭제 완료: "Activity '{name}' 삭제됨 (K개 태스크 매핑 해제)"
```

## 전체 흐름

```text
XML 업로드 → iframe calculate → cpm-calculated 메시지
  → upsertActivities()
    1. upsert rows
    2. orphan 식별
    3. 매핑 있는 orphan: name 매칭 → 자동이전 (UPDATE mapping)
    4. name 매칭 실패 + 매핑 있는 orphan → setOrphansToResolve()
    5. 매핑 없는 orphan → 즉시 삭제
    6. activity_log 기록
  → OrphanResolutionDialog 표시 (있는 경우)
    → 사용자 수동 이전/삭제
    → activity_log 기록
    → 완료 시 sendStatusToIframe()
```

