## 목표
`/design/import/logs`의 각 행을 클릭하면 해당 import 배치의 **행별 처리 결과(Row Logs)**를 같은 페이지에서 상세 뷰로 표시 (SHAW의 `DefectImportLogsPage`와 동일한 UX).

## 변경 사항

### 1. 신규 테이블 `mdr_import_row_logs` (마이그레이션)
배치(`mdr_import_logs`)별 행 단위 결과를 저장.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| import_log_id | uuid FK → mdr_import_logs(id) ON DELETE CASCADE | 배치 |
| source_sheet | text | 시트명 (DD/CD 등) |
| raw_row_no | int | 엑셀 원본 행 번호 |
| item_no | text | 도면 item_no |
| source_no | text | 원본 No. |
| drawing_title | text | 도면명 |
| action | text CHECK IN ('inserted','skipped_duplicate','skipped_existing') | 처리 결과 |
| reason | text | 스킵 사유 메모(옵션) |
| created_at | timestamptz default now() |

- 인덱스: `(import_log_id, action)`, `(import_log_id, raw_row_no)`
- GRANT: `SELECT, INSERT ON ... TO authenticated`, `ALL TO service_role`
- RLS: `is_admin_or_pm(auth.uid())` 정책 (기존 mdr_import_logs와 동일 패턴)

### 2. `src/lib/mdr/importRunner.ts` 수정
- `persistParsed`가 `importLogId` 인자를 받도록 변경.
- 신규 행은 `inserted`, 기존 도면과 일치하면 `skipped_existing`, 같은 파일 내 중복이면 `skipped_duplicate`로 분류.
- 행 단위 payload를 누적 → 청크(500건) 단위로 `mdr_import_row_logs`에 bulk insert.
- 호출부(`DesignImport.tsx`): `logImport()` 먼저 호출해 id 받기 → `persistParsed(..., logId)` 호출 순서로 정리.

### 3. `src/pages/DesignImportLogs.tsx` 확장
SHAW와 동일한 마스터-디테일 패턴:
- 행 클릭 → `selectedBatch` state set + URL `?batch=<id>` 동기화.
- 상단 ChevronLeft: 상세 뷰면 목록 복귀, 아니면 `/design/import`로 이동.
- 상세 뷰 카드:
  - 헤더: 파일명 + 요약 칩 (Inserted N / Skipped N)
  - 필터: action(All/Inserted/Skipped) · 시트(All/DD/CD/SD…) · 검색(item_no, drawing_title)
  - 테이블: Row# · Sheet · Item No · Source No · Title · Action(Badge) · Reason
  - 가상 렌더 한도 500행 + "Show more" 버튼

### 4. (선택) 기존 배치 호환
기존 `mdr_import_logs`에는 행 로그가 없음. 상세 뷰에서 빈 상태일 때 안내문 표시:
> "이 배치는 행 단위 상세 정보가 기록되기 전에 임포트되었습니다. 새 import부터 적용됩니다."

## 영향 파일
- `supabase/migrations/<new>.sql` (신규)
- `src/lib/mdr/importRunner.ts`
- `src/pages/DesignImport.tsx` (호출 순서 조정)
- `src/pages/DesignImportLogs.tsx` (상세 뷰 추가)
- `src/integrations/supabase/types.ts` (자동 재생성)

## 비범위
- Schedule Changes / Field Logs 탭 미포함 (사용자 선택대로 Row Logs만).
- Rollback 기능 미추가 (요청 외).
