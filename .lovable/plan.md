# 근본 원인

현재 DB 상태:
- `mdr_import_logs` / `mdr_import_row_logs` / `mdr_drawing_revisions`: 모두 **0건** (Purge 완료)
- `mdr_drawings`: **2,769건**, `mdr_milestones` / `mdr_progress`: 각 23,112건이 **고아 상태로 잔존**

`src/pages/DesignImportLogs.tsx`의 `purge()`(248–278행) 동작 방식:

```
fetchBatchScope() → mdr_import_row_logs WHERE action='inserted' 조회 → item_no 목록 확보
mdr_drawings DELETE WHERE building_code = ? AND item_no IN (...)
이후 row_logs / logs 본체 삭제
```

근본 결함은 **`mdr_drawings`에 어느 import 배치 소속인지 가리키는 외래키가 없음**. Purge는 `mdr_import_row_logs`의 `item_no` 목록을 우회 키로 사용한다. 따라서:

1. row_logs가 유실되었거나(이전 버그/수동 삭제), 한 도면이 이후 다른 batch에서 `rev_updated`로 기록된 뒤 원본 batch의 row_log가 제거되면 → Purge가 해당 drawing을 영원히 찾지 못함.
2. row_logs를 먼저 비우는 순간 도면–배치 연결이 끊겨 **영구 고아** 발생.
3. 결과: `import_logs` 0건인데도 drawings 2,769건이 남는 현 상황.

또한 `mdr_milestones`/`mdr_progress`는 `mdr_drawings`에 ON DELETE CASCADE이므로 drawings만 정리하면 함께 사라진다(현재는 drawings가 살아 있어 같이 잔존).

# 변경 사항

## 1. 스키마 보강 — `mdr_drawings.import_log_id` 도입

마이그레이션:
```sql
ALTER TABLE public.mdr_drawings
  ADD COLUMN import_log_id uuid REFERENCES public.mdr_import_logs(id) ON DELETE SET NULL;
CREATE INDEX idx_mdr_drawings_import_log_id ON public.mdr_drawings(import_log_id);
```

- `ON DELETE SET NULL`: 로그가 먼저 삭제되어도 drawings는 NULL로 남아 추적 가능.
- 임포트시 `import_log_id`를 현재 batch로 set(신규/갱신 모두).
- `created_import_log_id`(최초 생성 배치) 추가는 과잉이라 미도입. 단일 컬럼으로 "마지막 임포트 batch"만 추적.

## 2. 일회성 데이터 정리 (현재 고아 데이터)

마이그레이션에 포함:
```sql
DELETE FROM public.mdr_drawings WHERE import_log_id IS NULL;
-- mdr_milestones / mdr_progress / mdr_drawing_revisions(drawing_id FK) CASCADE
```
조건: 현 시점에 `mdr_import_logs` 0건이므로 모든 drawing이 고아 = 정상 정리 대상. 마이그레이션 실행 직후 drawings/milestones/progress 모두 0건이 됨.

## 3. `src/lib/mdr/importRunner.ts` — 임포트시 batch ID 기록

- 도면 insert payload에 `import_log_id: batchId` 추가.
- 도면 update payload(rev_updated 포함)에 `import_log_id: batchId` 추가하여 "마지막 갱신 배치"를 항상 갱신.

## 4. `src/pages/DesignImportLogs.tsx` — Purge / Rollback 재작성

**purge(log)**
```
1. mdr_drawings DELETE WHERE import_log_id = log.id  // CASCADE로 milestones/progress/revisions까지 정리
2. mdr_drawing_revisions DELETE WHERE import_log_id = log.id  // (rev_updated용 스냅샷 잔재)
3. mdr_import_row_logs DELETE WHERE import_log_id = log.id
4. mdr_import_logs DELETE WHERE id = log.id
```
- row_logs 의존 제거. `inserted` 카운트는 표시용으로 row_logs에서 미리 읽어 toast에 보여줌.

**rollback(log)**
- `inserted`: `import_log_id = log.id`인 drawing 중 row_logs에서 action='inserted'로 표시된 item_no만 삭제(스코프 좁힘 유지).
- `rev_updated`: 기존 로직 그대로 `mdr_drawing_revisions` 스냅샷에서 복원.
- 복원된 drawing의 `import_log_id`는 이전 batch로 되돌릴 수 없으므로 그대로 둠(필드는 "최근 임포트" 의미).

## 5. (선택) 관리자용 "고아 도면 정리" 액션

`DesignImportLogs` 헤더에 Admin 전용 버튼 추가:
- `import_log_id IS NULL` 도면 개수 표시 + 일괄 삭제 (확인 다이얼로그).
- 향후 동일 상황 재발 시 즉시 복구 수단.

## 6. 영향 / 검증

- 마이그레이션 직후 `/design/summary`의 도면 0건 상태가 일관되게 표시(이미 적용한 마스터 기반 행 렌더로 SMP&CCM 등은 "도면 없음" 배지로 노출).
- 임포트 → Purge 라운드트립: drawings/milestones/progress/revisions/row_logs/logs 모두 0건으로 떨어지는지 확인.
- 임포트 → Rollback: `inserted`는 삭제, `rev_updated`는 복원, 로그는 `rolled_back` 상태로 남는지 확인.

# 기술 사양

- 마이그레이션 한 번에 ALTER + 인덱스 + 일회성 cleanup 수행.
- 신규 컬럼은 NULLable → 기존 코드 호환.
- supabase types 재생성 후 importRunner / DesignImportLogs 수정.
