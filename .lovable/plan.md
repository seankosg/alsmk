
## 개요
업로드 엑셀(Sheet1 헤더행1: `No / Status / RFI/TQ No. / From / To / Title / Disp. / Originator / Issue Date / Due Date / Finish Date`)을 임포트해 원본 flat 로그를 **이벤트(테이블 B)**로 보존하고 rfi_no 기준으로 **마스터(테이블 A)**를 재구성합니다. 기존 Design → Raw Data는 "MDR Raw Data"로 리네이밍하고, 형제 페이지 "RFI Raw Data"를 추가합니다.

## 1. 라우팅/네비
- `/design` (DesignManagement) 타이틀 "MDR Raw Data"로 변경.
- 신규: `/design/rfi` (RfiRawData), `/design/rfi/import` (RfiImport).
- 사이드바/카드에 "MDR Raw Data" / "RFI Raw Data" 진입점.

## 2. 데이터베이스 (마이그레이션)

### `rfi_events` (테이블 B)
`id uuid pk`, `rfi_no text not null (idx)`, `raw_no int`, `raw_status text`,
`from_party text`, `to_party text`,
`direction text check in ('Outgoing','Incoming','Unknown')`,
`event_type text check in ('Send','Reply','Resend','Unknown')`,
`title text`, `title_clean text`, `discipline text`, `originator text`,
`issue_date date`, `due_date date`, `finish_date date`,
`import_log_id uuid`, `source_row_hash text unique`,
`source_filename text`, `created_at`, `updated_at`.

### `rfi_masters` (테이블 A)
`rfi_no text pk`, `direction`, `discipline`, `originator`, `title`,
`issue_date date`, `due_date date`, `response_date date`, `finish_date date`,
`status text check in ('Overdue','DueSoon','OnTrack','Closed','LateClosed','Info')`,
`event_count int`, `last_event_at date`, `updated_at`.

### `rfi_import_logs`
`id uuid pk`, `filename text`, `uploaded_by uuid`, `rows_total int`,
`rows_inserted int`, `rows_skipped int`, `status text`, `error_summary text`,
`storage_path text`, `created_at`.

### `rfi_reminders` (귀책 증빙/추적)
`id uuid pk`, `rfi_no text (idx)`, `event_id uuid`, `dm_id uuid null`,
`sent_by uuid`, `days_overdue int`, `subject text`, `body text`, `created_at`.

모든 테이블: RLS ON, 정책은 `public.is_admin_or_pm(auth.uid())` — MDR과 동일 패턴. GRANT `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role` (anon 제외).

### 스토리지
`rfi-uploads` **private** 버킷 (`supabase--storage_create_bucket` 도구). RLS 정책: admin/PM만 읽기/쓰기.
- **최근 1개만 보관 원칙**: 임포트 성공 시 이전 오브젝트 전량 삭제 후 신규 저장(경로 `latest/<filename>`). `rfi_import_logs.storage_path`에 기록.

### 재계산 함수 (개선)
`public.recompute_rfi_master(_rfi_no text)` — 이벤트 기준으로 마스터 upsert. 임포트 후 영향 rfi_no 셋에 대해서만 호출 → O(변경분).

## 3. 임포트 로직 (`src/lib/rfi/`)
- `parser.ts`: xlsx 파싱, 헤더행 자동탐지("RFI/TQ No." 컬럼 스캔), 날짜 정규화(`YYYY-MM-DD`).
- `directionClassifier.ts`: 
  - `_to ` 토큰 포함 → Outgoing, `_from ` 포함 → Incoming
  - Title `RE:` + Outgoing → Resend, `RE:` + Incoming → Reply, 그 외 Outgoing → Send
- `hash.ts`: `sha1(rfi_no|issue_date|from|to|title)` — 재임포트 멱등.
- `statusEngine.ts`: 
  - Outgoing + due_date 존재만 SLA 판정. 그 외 `Info`.
  - response_date 있음 → finish_date>due_date ? `LateClosed` : `Closed`
  - 미회신: today>due → `Overdue`, ≤3일 → `DueSoon`, 그 외 → `OnTrack`.
  - `days_overdue`는 화면 파생값.
- `importRunner.ts`: (1) 스토리지 최근파일 교체 (2) `rfi_import_logs` 생성 (3) 이벤트 upsert (4) 영향 rfi_no 재계산 (5) 결과 카운트 반영.

## 4. UI

### `RfiRawData.tsx`
- 헤더: "RFI Raw Data" + 최근 임포트 파일명·일시 표시(`rfi_import_logs` 최신).
- KPI 카드: 🔴 Overdue / 🟡 DueSoon / ⚪ Closed / Info.
- 필터: discipline, direction, status, 텍스트검색, 기준일.
- 마스터 테이블: 정렬 `status weight → days_overdue DESC`. Incoming/Closed 기본 접힘 토글.
- 행 액션: [🔄 리마인더 발송], [👁 타임라인].

### `RfiThreadDrawer`
해당 rfi_no 이벤트 시간순 타임라인 (Send→Reply→Resend 아이콘, 지연일 하이라이트).

### 리마인더 발송 v1 (사내 메시지 저장)
Overdue 행 버튼 → 다이얼로그:
- 자동 생성: 제목 `RE: [{rfi_no}] 답변 지연 통보 (D+{days_overdue})`, 본문에 issue_date/due_date/경과일/원문 title/귀책 문구 포함.
- 수신자 선택(members에서 검색, 다중선택).
- 확인 시:
  1) 각 수신자에 대해 `direct_messages` insert (기존 conversation 재사용 로직 준수)
  2) `rfi_reminders`에 감사 로그 저장 (dm_id 링크)
  3) 토스트 완료.
- **개선 제안**: 발송 후 마스터 행에 "Last reminder: {date}" 뱃지 표시 (재발송 남용 방지, `rfi_reminders`로 조회).

### `RfiImport.tsx`
기존 `ImportShell` 패턴 참고해 `RfiImportShell` 신설. 파싱 프리뷰(신규/기존/전체) → 실행 → 결과.

## 5. MDR 리네이밍
- `DesignManagement.tsx`: 헤더/뱃지 "MDR Raw Data".
- Design 랜딩(있으면)에 MDR / RFI 카드 2개.

## 6. 재임포트 멱등성 & 원본파일 보관
- 이벤트 upsert 키: `source_row_hash unique`.
- 스토리지: 임포트 성공 시 `rfi-uploads/` 내 이전 오브젝트 전량 삭제 → 신규 1개만 유지. `source_filename` 이벤트 행에도 기록해 Raw Data 화면에서 각 이벤트의 출처 파일명 확인 가능.

## 7. 개선 제안 (문서화만, 승인 시 별도 이슈)
- **자동 리마인더**: `pg_cron` + edge function으로 매일 오전 Overdue 담당자에 자동 DM (사용자 승인 후).
- **Time-bar Export**: 스레드별 이벤트 타임라인 XLSX/PDF export.
- **첨부 원문 링크**: 스키마에 `external_url text` 여유 컬럼 미리 마련해두면 향후 문서시스템 연동 편함 → 이번 마이그레이션에 포함.

## 작업 순서
1. **마이그레이션 승인** (rfi_events / rfi_masters / rfi_import_logs / rfi_reminders + 정책 + `recompute_rfi_master`).
2. `rfi-uploads` 프라이빗 버킷 생성 + RLS.
3. `src/lib/rfi/*` 파서·분류·러너·스테이터스.
4. `RfiRawData` / `RfiThreadDrawer` / `RfiImport` + 라우트 등록.
5. `DesignManagement` 리네이밍, 진입 카드 추가.
6. 업로드 파일로 검증 (엑셀 34행 → 이벤트 34, 마스터 N개, Overdue/DueSoon 카운트 확인, 리마인더 DM 저장 확인, 재임포트 시 신규 0건 확인).
