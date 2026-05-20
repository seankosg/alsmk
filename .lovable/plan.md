## 배경
최근 `tasks_task_code_key` UNIQUE 제약은 부분 unique index (`idx_tasks_task_code_active`, `WHERE deleted_at IS NULL`)로 교체되었습니다. 즉 **활성 행끼리만** 고유해야 합니다. 이 전제 위에서 코드/트리거/RPC 전반을 점검하면 다음 경로에서 **여전히 UNIQUE 위반이 발생할 수 있는 결함**들이 남아 있습니다.

---

## 발견된 위반 가능 시나리오

### 1. (HIGH) `generate_task_code` 트리거 — 서브태스크 시퀀스 재사용 충돌
`supabase/migrations/20260520073801_*.sql`:
```
SELECT count(*) ... WHERE parent_id=NEW.parent_id AND id!=NEW.id AND deleted_at IS NULL;
NEW.task_code := v_parent_code || '-' || lpad((v_sub_count + 1), 2, '0');
```
- 부모에 `-01, -02, -03`이 있고 가운데 `-02`를 soft delete → active sibling count = 2.
- 새 subtask 추가 → 코드 `-03` 생성 → **기존 활성 `-03`과 충돌**.

### 2. (HIGH) Restore 시 코드 충돌 — `DeletedTasksList.handleRestore`
`src/components/tasks/DeletedTasksList.tsx:68-79`:
```
update({ deleted_at: null })  // ← 먼저 실행
resequence_subtask_codes(...)  // ← UPDATE 성공 후에야 호출
```
- 삭제 당시 코드(`PARENT-02`)를 그대로 보존한 채 `deleted_at=null`로 만드는 순간, 그 사이 새로 생긴 active `PARENT-02`와 부분 unique index 충돌로 UPDATE 자체가 실패.
- Top-level task 복원 시에도 동일: backup-restore/임의 시퀀스 재설정 후 같은 코드가 active로 재발급된 상황이면 충돌.

### 3. (HIGH) `Workspace.handleGenerateSummaries` — 수동 코드 부여
`src/pages/Workspace.tsx:178-185, 213-219`:
```ts
task_code: summaryCode + "-" + String(i+1).padStart(2,"0")
```
- 이미 다른 summary나 동일 summary의 기존 subtask가 같은 `SUMMARY-01` 코드를 보유하고 있으면 직접 UPDATE가 충돌.
- 또한 두 번째 패스 없이 단일 UPDATE라 동일 그룹 내부에서도 일시적 중복 발생 가능 (resequence가 쓰는 TMP suffix 패턴 없음).

### 4. (MED) `add_subtask` RPC — 부모 복제 시 트리거 의존
`add_subtask`는 부모를 summary로 만들고 **원본을 첫 subtask로 INSERT** → 트리거가 코드 생성 → 그 후 `resequence_subtask_codes` 호출. resequence는 TMP suffix를 쓰므로 자체 충돌은 없지만, INSERT 시점에 #1 시나리오(중간 soft-delete 형제 존재)가 있으면 INSERT 자체가 먼저 실패해 RPC 전체가 롤백.

### 5. (MED) Backup Import (`supabase/functions/backup-import`)
`tasks` 행을 원본 `task_code` 그대로 upsert. 백업 시점 이후 새로 생성된 동일 코드의 active 행이 있거나, 백업 자체에 활성+활성 중복이 있으면 충돌. 또한 `task_code_sequences`를 함께 복원하지 않으면 이후 신규 발급이 이미 존재하는 번호와 충돌 가능.

### 6. (LOW) `task_code_sequences` 자체는 안전
시퀀스는 단조 증가하므로 같은 `(team,part,YYMM)` 내 신규 top-level 코드 충돌은 발생하지 않음 — 단 위 #5처럼 외부 데이터 주입이 시퀀스 상태와 어긋날 때만 위험.

---

## 수정 방안 (마이그레이션 + 코드)

### A. 트리거 보강 — 안전한 다음 번호 산정
`generate_task_code`의 subtask 분기에서 단순 count 대신 **현재 사용 중인 suffix를 파싱해서 다음 번호 산출**:
```sql
SELECT COALESCE(MAX(
  NULLIF(regexp_replace(task_code, '^' || v_parent_code || '-', ''), '')::int
), 0) + 1
INTO v_next
FROM public.tasks
WHERE parent_id = NEW.parent_id
  AND deleted_at IS NULL
  AND task_code ~ ('^' || v_parent_code || '-\d+$');
NEW.task_code := v_parent_code || '-' || lpad(v_next::text, 2, '0');
```
또한 만약을 위해 충돌 시 retry 루프(최대 5회)로 다음 번호를 재계산.

### B. Restore 안전화 — RPC로 트랜잭션 처리
`restore_task(_id uuid)` SECURITY DEFINER RPC 신설:
1. 대상 행 잠금, parent_id/task_code 조회.
2. **충돌 검사**: active 중 같은 task_code 존재 시 → 즉시 임시 코드(`...-RESTORE-<rand>`)로 변경 후 unset deleted_at.
3. parent가 있으면 `resequence_subtask_codes(parent_id)` 호출.
4. top-level인데 충돌이 있었던 경우, 새 시퀀스 번호로 재발급(`generate_task_code` 로직 재사용 가능하도록 helper 분리).

`DeletedTasksList.handleRestore`는 위 RPC만 호출하도록 단순화.

### C. Workspace Generate Summaries — TMP suffix 2-pass
- 동일 summary 그룹의 subtask 코드 갱신 시 1) 모두 `SUMMARY-TMP-<ts>-<i>`로 UPDATE → 2) 최종 `SUMMARY-NN`으로 UPDATE.
- 더 안전한 대안: 신규 RPC `set_summary_children(_summary_id uuid, _child_ids uuid[])`를 만들어 서버에서 일괄 처리.

### D. Backup Import 가드
- import 진입 시 같은 `task_code` 활성 행이 있으면 import 행에 한해 코드 무효화(null) 후 트리거가 새로 발급하도록 처리.
- `task_code_sequences`도 같이 복원하거나 import 후 `MAX(seq)`로 재정렬.

### E. 부분 unique index 유지 + 보조 인덱스 점검
현재 인덱스는 적절. 추가로 `task_code IS NOT NULL` 조건 하에 운영 중인 검색 쿼리에 영향 없음.

---

## 영향 파일 (실행 단계에서 수정 예정)
- `supabase/migrations/<new>.sql` — A(트리거 교체), B(`restore_task` RPC), C 보조 RPC, helper 함수
- `src/components/tasks/DeletedTasksList.tsx` — restore RPC 호출로 교체
- `src/pages/Workspace.tsx` — Generate Summaries 2-pass 또는 RPC 호출
- `supabase/functions/backup-import/index.ts` — 충돌 가드 + 시퀀스 재정렬

## 검증 시나리오
1. parent에 3개 subtask, 중간 삭제 후 신규 추가 → 충돌 없이 다음 번호 발급.
2. 같은 코드의 active 행 존재 상태에서 삭제된 동일 코드 task 복원 → 새 코드로 복원 성공.
3. Generate Summaries 두 번 연속 실행 → 충돌 없음.
4. Backup export → 일부 행 삭제 후 import → 모든 행 복원 + 코드 유일성 유지.