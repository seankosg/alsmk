# MDR Import 드릴다운 누락 수정 (RPC 방식)

## 배경

`02_SMP&CCM_MDR progress.xlsx` 임포트 로그가 Skipped 7건으로 표시되지만 드릴다운에는 3건만 보이는 문제. 원인은 PostgREST의 응답 행 기본 상한 1000행이고, 해당 배치의 row log가 1337건이라 끝부분이 잘립니다. 다른 배치도 행 수가 1000을 넘으면 동일 증상이 발생합니다.

## 해결 방향

DB 함수(RPC) 하나를 만들어 `import_log_id` 기준 전체 행을 단일 호출로 반환합니다. PostgREST 행 상한은 RPC 결과에 적용되지 않아 본 문제가 근본 해결되고, 임포트 로직·UX·중복 검출 규칙은 전혀 건드리지 않습니다.

## 변경 사항

### 1) DB 함수 신설 (migration)

함수명: `public.get_mdr_import_row_logs(_import_log_id uuid)`

- 반환: `mdr_import_row_logs`의 화면용 컬럼 9개 (id, source_sheet, raw_row_no, item_no, source_no, drawing_title, doc_base, action, reason)
- 정렬: `source_sheet ASC, raw_row_no ASC, id ASC` — 시트 간 동일 행번호가 있어도 안정 정렬
- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
- `GRANT EXECUTE ... TO authenticated, service_role`
- 본문은 단순 SELECT 한 줄이라 유지보수 부담 낮음

### 2) 클라이언트 호출 교체

`src/pages/DesignImportLogs.tsx`의 `loadRowLogs(batchId)`:

- 기존: `from("mdr_import_row_logs").select(...).eq("import_log_id", batchId).order("raw_row_no").limit(50000)`
- 변경: `supabase.rpc("get_mdr_import_row_logs", { _import_log_id: batchId })`
- 에러 시 toast + 1회 자동 재시도, 실패 확정 시 기존 빈 상태 유지

다른 파일은 수정하지 않습니다. 엑셀 다운로드는 `rowLogs` 상태를 그대로 사용하므로 자동으로 전체 행 반영됩니다.

## 검증

1. 02_SMP&CCM 배치 드릴다운에서 Skipped 7건이 모두 표시되는지 확인
2. 기존 정상 배치(1000행 이하)도 동일하게 표시되는지 확인
3. 엑셀 다운로드 결과 행 수가 화면 표시와 일치하는지 확인

## 기술 메모

- RPC 함수는 단일 호출이라 부분 성공 상태가 없어 에러 처리가 단순해집니다.
- 향후 도면 수가 5~10배(약 1~2만 행)로 증가하면 RPC 시그니처에 `_after_id uuid DEFAULT NULL, _limit int DEFAULT 5000` cursor 파라미터를 추가해 확장 가능합니다. 현 단계에선 불필요.
- `mdr_import_row_logs` 테이블에 `(import_log_id, raw_row_no)` 인덱스가 없다면 함수 응답이 느려질 수 있으므로 migration 시 인덱스 존재 여부를 확인하고 없으면 함께 생성합니다.
