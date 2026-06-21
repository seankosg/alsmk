# 임포트 로그 — 롤백 / 데이터 삭제 버튼

## 제거
- 현재 행 우측의 **로그 삭제** 버튼(`deleteLog` + `Trash2` AlertDialog) 제거
- 관련 state(`deletingId`) 정리

## 신규 액션 2종 (Admin 전용)

### 1. 롤백 (Rollback)
이 임포트로 발생한 변경을 되돌립니다.
- `mdr_import_row_logs`에서 이 batch의 `inserted` 행 → 해당 `item_no` (또는 `doc_base`) 도면을 `mdr_drawings`에서 삭제 (CASCADE로 milestones/progress/revisions 정리)
- 같은 batch의 `rev_updated` 행 → `mdr_drawing_revisions`에서 `import_log_id = batchId` 인 이력 스냅샷을 찾아, 해당 도면의 `rev / drawing_title / plan_finish / out_of_scope`를 이력 시점으로 되돌리고, `progress_snapshot`의 마일스톤·진행률을 다시 주입(기존 mdr_milestones/mdr_progress 삭제 후 재삽입). 복원 후 사용한 이력 행은 삭제.
- 로그 자체는 보존하고 `status = 'rolled_back'` 으로 표시. row logs는 보존.
- 확인 다이얼로그에 영향 카운트 미리 보여주기: "신규 N건 삭제, Rev 갱신 M건 복원"

### 2. 데이터 삭제 (Purge)
이 임포트로 신규 추가된 도면 + 이력 + 로그를 **영구 삭제**합니다 (복원 불가).
- 이 batch의 `inserted` 행 → 해당 도면 삭제 (CASCADE)
- 이 batch가 만든 `mdr_drawing_revisions` 이력 행 삭제 (`import_log_id = batchId`)
- `mdr_import_row_logs` 삭제
- `mdr_import_logs` 삭제
- Rev 갱신된 도면은 손대지 않음(이미 새 Rev로 운용 중이므로). 다이얼로그에 명시.

## UI
`/design/import/logs` 행 우측 액션 컬럼에 두 버튼 묶음:
- ↺ **Rollback** (secondary outline)
- 🗑 **Purge** (destructive)

각 버튼은 빨강/노랑 톤의 `AlertDialog`로 영향 범위를 보여준 뒤 실행. 실행 중 스피너 표시. 완료 후 목록 refetch.

`status = 'rolled_back'` 인 로그는 두 버튼 모두 비활성화(이미 되돌려졌으므로 Purge로 정리만 가능 → Purge는 활성 유지, Rollback만 비활성).

## DB
스키마 변경 없음. 모든 조작은 클라이언트에서 supabase 호출로 처리.
`mdr_import_logs.status`는 기존 text 컬럼이라 그대로 `'rolled_back'` 사용 가능.

## 변경 파일
- `src/pages/DesignImportLogs.tsx` — 로그 삭제 제거, Rollback/Purge 함수와 다이얼로그 추가, 상태 배지 매핑에 `rolled_back` 추가
