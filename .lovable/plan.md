# SHAW 풍 Import / Import Logs 페이지 도입

SHAW PROJECT CMS의 Import UI(드래그-드롭 카드, 파일별 상태 배지, 결과 배지)와 Import Logs 페이지를 그대로 본떠서, 현재 `MdrImportDialog` 다이얼로그를 전용 페이지로 교체합니다. **백엔드는 기존 `mdr_import_logs` / `mdr_drawings` / `mdr_milestones` / `mdr_progress` 구조 그대로 유지**하고, UI 레이어와 화면 라우팅만 새로 만듭니다.

## 변경 요약

```text
[추가]
  src/pages/DesignImport.tsx             SHAW 풍 Import 페이지
  src/pages/DesignImportLogs.tsx         SHAW 풍 Import 이력 페이지
  src/components/mdr/import/ImportShell.tsx   드래그-드롭 카드 UI (SHAW DocsImportShell 축약판)
  src/components/mdr/import/useMdrImporter.ts 파일 상태/파싱/임포트 훅 (기존 parser·persist 로직 래핑)

[수정]
  src/App.tsx                            라우트 2개 추가
  src/pages/DesignManagement.tsx         Raw Data 헤더의 Import 버튼을
                                          → `/design/import` 링크로 교체
                                          + 옆에 'Import Logs' 아웃라인 버튼 추가
  src/pages/DesignDashboard.tsx          '최근 임포트 로그' 카드 제거

[제거]
  src/components/mdr/MdrImportDialog.tsx 더 이상 사용되지 않음 — 삭제
```

## 1. 라우팅

`src/App.tsx` 에 두 라우트를 추가합니다(Admin/PM 가드는 기존 `DesignManagement`와 동일하게 페이지 내부에서 처리).

- `/design/import` → `DesignImport`
- `/design/import/logs` → `DesignImportLogs`

## 2. `DesignImport.tsx` + `ImportShell.tsx`

SHAW `DocsImportShell` 구조를 단일-서브모듈 버전으로 축약. 표현 요소만 동일하게 가져오고, 데이터/검증 규칙은 현재 MDR 로직(`src/lib/mdr/parser.ts`, `validator.ts`, 기존 `persistParsed`)을 그대로 사용합니다.

화면 구성:

```text
Header  ────────────────────────────────────────────────
  ▸ Title: "MDR Import"
  ▸ Description: "Upload MDR Excel(.xlsx, .xls) ..."
  ▸ Right: [ View Import Logs ] 버튼  →  /design/import/logs

Card 1. Upload Files
  ▸ 점선 드롭존 + click-to-browse, multiple, .xlsx/.xls

Card 2. Files (N)
  ▸ Header: "{N} ready to import" + [Clear all] [Start import (N)]
  ▸ 파일 카드 (SHAW와 동일 레이아웃)
      • 좌: 파일 아이콘, 이름, 크기 · sheets · parsedCount rows
      • 검증 에러/경고/SUMMARY 스킵 사유 표시
      • 우: status Badge (pending/parsing/ready/processing/done/failed) + X 제거
      • processing: 하단 Progress 바
      • done: Inserted / Skipped 결과 Badge (현재 persist 결과 매핑)
```

상태 훅 `useMdrImporter`:

- `files: ImportFile[]` — id, name, size, status, sheetNames, parsedCount, validationError, error, result {inserted, skipped}
- `addFiles(File[])` → 즉시 `parseMdrFile` + `validateSheet` 실행해 ready/failed 결정 (SUMMARY 파일은 자동 ready=false, 사유 표시)
- `removeFile(id)`, `clearAll()`
- `startImport()` → 순차 처리. 각 파일별로 `persistParsed`(기존 로직을 모듈 함수로 추출) 호출하고 `result` 업데이트. 기존처럼 `mdr_import_logs` insert.

기존 `MdrImportDialog`의 `persistParsed` / `logImport`는 `src/lib/mdr/importRunner.ts`로 이동해 페이지/훅에서 재사용합니다(다이얼로그 파일 자체는 제거).

## 3. `DesignImportLogs.tsx`

SHAW `DocsImportLogsPage`의 **목록 화면**만 본뜬 단일 테이블 페이지. row-level/필드-level 로그 테이블이 현재 없으므로 상세 화면은 만들지 않습니다(드릴다운 없음).

- 좌상단 [◀] → `/design/import`
- 제목: "MDR Import History"
- 테이블 컬럼: File · Building · Date · Uploader · Status · Inserted · Skipped · Error · (admin) 삭제
- 데이터: `mdr_import_logs` 전체 (최신 100건, `imported_at desc`)
- Uploader 이름은 SHAW와 동일 방식으로 `profiles`(or `members`) 조인 매핑
- 상태/액션 컬러는 SHAW의 `statusColor` 매핑(`completed/processing/failed`)을 `success/failed` 두 가지로 축소 사용
- Admin만 보이는 삭제 버튼은 단순 `delete from mdr_import_logs where id = …` (RPC 불필요)

## 4. `DesignManagement.tsx` 변경

Raw Data 헤더 우측의 단일 `Import` 버튼을 두 개로 교체:

```tsx
<Link to="/design/import"><Button><Upload/> Import</Button></Link>
<Link to="/design/import/logs"><Button variant="outline"><History/> Import Logs</Button></Link>
```

기존 `MdrImportDialog` 마운트와 `importOpen` 상태는 삭제.

## 5. `DesignDashboard.tsx` 변경

`{/* 6. 최근 임포트 로그 */}` 카드 블록(212–229) 및 관련 `logs` 쿼리 제거.

## 검증 방법

- 빌드 통과 확인
- Playwright로 `/design/import` 접속 → 가짜 xlsx 드롭이 어려우면 최소 라우트 렌더링 + 헤더 버튼 스크린샷
- `/design/import/logs` 렌더링 스크린샷 — 기존 `mdr_import_logs` 행이 표시되는지 확인
- `/design` 헤더에 Import / Import Logs 두 버튼이 보이는지 확인
- `/design/dashboard`에서 '최근 임포트 로그' 카드가 사라졌는지 확인

## 범위 외 (별도 합의 필요)

- 배치/Row/Field 단위 로그 테이블 신설 (사용자 선택지 A이므로 제외)
- Rollback / Auto-register masters / Header Mappings / Similar Master Dialog
- 모듈 pause / external-busy 가드, Per-file Data Date, Select Columns 다이얼로그 — 현재 MDR 파이프라인에 대응 개념이 없어 SHAW UI 중 해당 요소들은 렌더링하지 않음
