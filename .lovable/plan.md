## 문제 원인

`MDR Import History → Import Row Details` 화면이 2156행 중 1000행만 보여주는 것은 **PostgREST의 응답 최대 행수 제한(기본 1000)** 때문입니다.

- DB의 `get_mdr_import_row_logs` RPC 자체는 LIMIT이 없고 모든 행을 반환합니다.
- 그러나 클라이언트가 `supabase.rpc(...)` 한 번 호출로 받아올 때 PostgREST가 응답을 1000행으로 잘라냅니다 (서버 설정값, 사용자가 변경 불가).
- 그래서 화면 우측 상단에 "1,000 / 1,000건"으로 표시되고 나머지 1156행은 누락됩니다.

도면 수가 늘어날수록 손실 폭이 커지므로 한 번 호출로 모두 받는 방식은 한계가 있습니다.

## 해결 방법

`src/pages/DesignImportLogs.tsx`의 `loadRowLogs(batchId)`를 **`.range()` 기반 페이지네이션 루프**로 바꿉니다. 한 번에 1000행씩 받아 누적하고, 반환 행 수가 페이지 크기보다 작으면 종료합니다.

```ts
const PAGE = 1000;
const all: RowLog[] = [];
let from = 0;
while (true) {
  const { data, error } = await (supabase as any)
    .rpc("get_mdr_import_row_logs", { _import_log_id: batchId })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  const chunk = (data as RowLog[]) ?? [];
  all.push(...chunk);
  if (chunk.length < PAGE) break;
  from += PAGE;
  if (from > 200_000) break; // 안전 가드
}
setRowLogs(all);
```

- RPC가 `RETURNS TABLE`이라 `.range()`가 PostgREST에서 정상 동작합니다 (서버 측 ORDER BY가 이미 안정 정렬).
- 1회 실패시 재시도 로직은 페이지 단위로 유지(첫 페이지 실패만 한 번 재시도).
- 로딩 중에는 기존처럼 `rowsBusy` 유지, 사용자는 한 번의 스피너만 봄.

## 그 외 확인 / 부수 작업

- `fetchBatchScope`(롤백용)는 이미 `.limit(50000)`를 지정하고 있지만, 동일하게 PostgREST 제한에 걸릴 수 있습니다. 안전을 위해 같은 패턴의 `.range()` 페이지네이션으로 변경 (rollback 시 누락 방지).
- UI 상단의 "X / Y건" 카운터는 그대로 `rowLogs.length` 기반이라 자동으로 정확해집니다.
- 서버/마이그레이션 변경 없음 (RPC는 그대로 사용).

## 검증

1. `/design/import/logs?batch=<CRM 배치 id>` 진입 → 상단 카운터가 `2,156 / 2,156건`으로 표시되는지 확인.
2. 필터/검색이 전체 2156행에 대해 동작하는지 확인.
3. HSM(1005+4) 등 1000 초과 배치도 동일하게 정상 표시되는지 확인.
4. 1000행 이하 배치(GEN 37, FAFP 83 등)는 페이지네이션이 1회만 돌고 종료되는지 확인.
