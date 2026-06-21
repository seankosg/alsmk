# Doc No. + Rev 이력 관리 (국제 표준 기반)

## 국제 규정 검토 요약
- **ISO 7200 (Title block)**: 도면 헤더에 *Document identifier* + *Revision index* 를 분리해 표기. 식별자는 영구, Rev만 갱신.
- **ISO 9001 / ISO 10005 (문서관리)**: 모든 리비전을 **추적 가능(traceable)** 하게 보존, 이전 Rev는 *Superseded(폐기 대체)* 상태로 보관.
- **EPC Master Document Register 관례 (Hexagon SDx, Aveva, qdmssolutions)**:
  - "Current Revision" 1행 + "Revision History" 다행 구조
  - 이전 Rev는 삭제 금지, `superseded_at` 타임스탬프로 표시
  - Rev 코드: IFR(Issued for Review), IFA(Approval), IFC(Construction), AFC(As-built) 등 알파/숫자 혼용 허용

## 적용 사양

### 도면 식별
- `doc_base` = `{Job}-{Area}-{Function}-{Serial}` — **영구 고유 키** (절대 변경 안 됨)
- `rev` = 현재 리비전 코드 (`0`, `1`, `A`, `IFC` 등 문자열 그대로 보존)
- `doc_no` = `doc_base + "-" + rev` — 표시·필터·검색용 컬럼

### Rev 이력 보존 — 2-테이블 구조
**`mdr_drawings`** (현재 Rev = "live")
- 한 도면당 1행. `(building_code, doc_base)` UNIQUE
- 재임포트 시 Rev가 바뀌면 이 행을 갱신, **그 전에 이전 상태를 이력 테이블로 복사**

**`mdr_drawing_revisions`** (신설, 이력)
- `id`, `drawing_id`(FK→mdr_drawings, ON DELETE CASCADE)
- `building_code`, `doc_base`, `rev`
- `drawing_title`, `plan_finish`, `actual_finish`, `out_of_scope`
- `progress_snapshot JSONB` — 해당 Rev 시점 마일스톤·진행률 스냅샷
- `source_sheet`, `import_log_id`(FK→mdr_import_logs)
- `superseded_at` (이력으로 옮겨진 시각), `superseded_by_rev`
- `created_at`

### 임포트 시 동작
1. `(building_code, doc_base)` 기존 행 조회
2. 없으면 신규 insert (이력 없음)
3. 있고 Rev 동일 → 기존대로 데이터 갱신만
4. 있고 Rev **다름** →
   - 기존 행 상태를 `mdr_drawing_revisions`에 복사 (`superseded_at=now, superseded_by_rev=new`)
   - `mdr_drawings` 행을 새 Rev로 갱신 (`id` 보존 → 마일스톤·진행 FK 유지)

### UI
- 그리드: **Doc No.** 컬럼을 Item No. 좌측에 추가, 현재 Rev 포함 표시
- 행 옆에 작은 배지 `Rev N` (Rev≥1이면 강조)
- 행 클릭 시 사이드 패널 또는 "Revision History" 탭에서 과거 Rev 목록 (rev, superseded_at, plan_finish, overall_pct) 표시
- 이력은 읽기 전용

## 변경 파일
1. **migration**: `mdr_drawings`에 `rev`, `doc_base`, `doc_no` + UNIQUE; `mdr_drawing_revisions` 신설 + RLS + GRANT
2. **`src/lib/mdr/parser.ts`**: `rev`, `docBase`, `docNo` 파싱
3. **`src/lib/mdr/importRunner.ts`**: upsert + 이력 복사 로직
4. **`src/integrations/supabase/types.ts`**: 자동 재생성
5. **`src/components/mdr/grid/columns.tsx`**: Doc No. 컬럼 + `rev` 배지
6. **`src/components/mdr/grid/MdrAdvancedGrid.tsx`**: row 매핑
7. **(신규) `src/components/mdr/RevisionHistoryDialog.tsx`**: 이력 조회 다이얼로그

## 범위 제한
- Rev 비교/diff 뷰는 이번 범위 외 (이력 보존만)
- Rev 알파벳 자동 증가(A→B) 같은 자동 채번은 하지 않음 — Excel 원본 Rev 그대로 사용

이 방향으로 진행할까요? 또는 이력 테이블 없이 단일 행만 갱신하는 단순안을 원하시면 알려주세요.
