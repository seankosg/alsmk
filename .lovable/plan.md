## Export 기능 2종 분리 (저장용량 최적화)

그리드 툴바의 단일 Export 버튼을 **두 가지 모드**로 분리합니다.

### 모드 1 — Raw Data 내보내기 (보이는 그대로)
- 현재 `exportFilteredXlsx` 그대로 유지 (필터/정렬/표시 컬럼 기준 .xlsx 생성).
- 라벨: **"Raw Data 내보내기"**.
- 파일명: `mdr_raw_{building}_{sheet}_{date}.xlsx`.

### 모드 2 — Template로 내보내기 (임포트 양식 그대로)
- 임포트 시 업로드된 **원본 워크북**을 템플릿으로 사용.
- 셀 서식·머지·열폭·미인식 컬럼 보존, 앱이 관리하는 값(마일스톤 Y/N, 메타, 목표완료일)만 최신 DB 값으로 덮어쓰기, 신규 도면은 마지막에 append.
- 라벨: **"Template로 내보내기"**.
- 파일명: `mdr_template_{building}_{date}.xlsx`.
- 기존 `src/lib/mdr/exporter.ts` 의 `exportFromTemplate()` 재사용.

### 원본 워크북 저장 — Building 당 최신 1개만 유지
저장 용량을 최소화하기 위해 **building 별로 가장 최근 임포트 파일 1개만** Storage 에 보관합니다.

- 비공개 버킷 `mdr-templates` 생성 (admin/pm 만 read/write).
- 객체 경로 규칙: `{building_code}/template.xlsx` (고정 키 → 덮어쓰기로 자동 1개 유지).
- 새 임포트 성공 시 `supabase.storage.upload(path, file, { upsert: true })` 로 기존 파일 덮어쓰기.
- 별도 마이그레이션 컬럼 추가 없음 — 경로가 building_code 로 결정되므로 DB 에 path 저장 불필요.
- 과거에 임포트한 building 은 파일이 없으므로, Storage HEAD 조회 실패 시 모드 2 버튼 비활성화 + 툴팁: "원본 양식이 저장된 임포트가 없습니다. 다시 임포트해주세요."

### 변경 파일
- `supabase storage_create_bucket` 호출 → `mdr-templates` (private).
- `supabase/migrations/<new>.sql` — `storage.objects` 에 admin/pm only RLS 정책 (bucket_id = 'mdr-templates').
- `src/lib/mdr/importRunner.ts` — 함수 시그니처에 원본 `File` 추가, snapshot insert 직후 Storage 에 `{building}/template.xlsx` upsert 업로드.
- `src/components/mdr/import/useMdrImporter.ts` — runner 호출 시 `item.file` 그대로 전달.
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`:
  - 기존 단일 버튼 → DropdownMenu (Export ▾) 로 묶음.
  - 항목 1: **"Raw Data 내보내기"** — 기존 동작.
  - 항목 2: **"Template로 내보내기"** — Storage download → `mdr_drawings` + `mdr_progress` + `mdr_milestone_cells` 조회 → `MdrExportDrawing[]` 매핑 → `exportFromTemplate()` → 다운로드.
  - 마운트 시 Storage 에 파일 존재 여부 1회 확인하여 비활성/활성 결정.

### 검증
- 새 임포트 → Storage `mdr-templates/{building}/template.xlsx` 가 항상 최신본으로 단일 존재.
- 같은 building 재임포트 시 이전 파일이 덮어써져 누적되지 않음 (용량 일정).
- "Raw Data 내보내기": 기존 결과와 동일.
- "Template로 내보내기": 원본 헤더/서식 그대로, 마일스톤·메타 컬럼만 DB 최신값 반영, 신규 도면 append 확인.
- 원본 없는 building 은 메뉴 항목 비활성 + 안내 툴팁.
