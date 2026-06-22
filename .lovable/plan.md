# Doc No. 형식 전면 개편

## 목표
도면 식별자(docBase / Doc No.)의 구성요소 명칭과 데이터 출처를 다음과 같이 통일한다.

- 이전: `JOB-Area Code-Function Code-Serial No.-Rev.`
- 변경: `Plant ID-PBS-FBS-SER.NO.-Rev.`

UI 라벨, 엑셀 헤더, 내부 코드, DB 컬럼명까지 모든 레이어에 일관되게 반영한다.

## 매핑 정의

| 신규 | 이전 (deprecated) | DB 컬럼 (변경 후) |
|---|---|---|
| Plant ID | JOB No. | `plant_id` |
| PBS | Area Code | `pbs` |
| FBS | Function Code | `fbs` |
| SER.NO. | Serial No. | `ser_no` |
| Rev. | Rev. (변경 없음) | `rev` |

docBase 합성 규칙: `{Plant ID}-{PBS}-{FBS}-{SER.NO.}` (4개 토큰 모두 비어있으면 null, 기존 로직 유지).
docNo 합성 규칙: `{docBase}-{Rev.}` (기존 동일).

## 변경 항목

### 1. DB 마이그레이션 (`mdr_drawings` 테이블)
- `job_no` → `plant_id`
- `area_code` → `pbs`
- `function_code` → `fbs`
- `serial_no` → `ser_no`
- `mdr_drawing_revisions`는 `doc_base`/`doc_no`/`rev`만 저장하므로 컬럼 변경 없음.
- 기존 행 데이터는 rename으로 자동 보존됨(값 손실 없음).

### 2. 파서 (`src/lib/mdr/parser.ts`)
- `MdrParsedRow` 타입 필드명: `jobNo`→`plantId`, `areaCode`→`pbs`, `functionCode`→`fbs`, `serialNo`→`serNo`.
- 엑셀 헤더 인식 `findVal` 호출에 신규 명칭을 1순위로, 기존 명칭을 fallback으로 등록.
  - `plantId`: `findVal("Plant ID", "PLANT", "JOB")`
  - `pbs`: `findVal("PBS", "Area Code", "AREA")`
  - `fbs`: `findVal("FBS", "Function Code", "FUNCTION", "FUCTION")`
  - `serNo`: `findVal("SER.NO.", "SER NO", "SERIAL", "Serial")`
- `isIdentHeader` 정규식에 `plant|pbs|fbs|ser` 추가하여 마일스톤 그룹 경계 인식 유지.

### 3. 컬럼 사전 (`src/lib/mdr/columnMap.ts`)
- 키 rename + 헤더 텍스트 변경:
  - `plantId: { header: "Plant ID" }`
  - `pbs: { header: "PBS" }`
  - `fbs: { header: "FBS" }`
  - `serNo: { header: "SER.NO." }`
- `detectColumnKey`는 신규 헤더와 더불어 기존 헤더(`JOB No.`, `Area Code`, `Function Code`, `Serial No.`)도 동일 키로 매칭하도록 별칭 테이블 추가 (구버전 엑셀 재임포트 호환).

### 4. ImportRunner (`src/lib/mdr/importRunner.ts`)
- DB insert/update payload 키를 신규 컬럼명으로 교체 (`plant_id`, `pbs`, `fbs`, `ser_no`).

### 5. Exporter (`src/lib/mdr/exporter.ts`)
- `MdrExportRow` 필드명 rename. 엑셀 출력 헤더가 `Plant ID / PBS / FBS / SER.NO.`로 나가도록 보장.

### 6. Grid 및 UI
- `src/components/mdr/grid/columns.tsx`
  - 컬럼 키와 헤더 라벨 변경: `plant_id` "Plant ID", `pbs` "PBS", `fbs` "FBS", `ser_no` "SER.NO."
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`
  - 매핑 객체 필드 rename.
- 그 외 도면 관련 카드/툴팁/요약 패널에서 동일 라벨 사용처 일괄 점검 및 교체.

### 7. 타입 동기화
- DB 마이그레이션 후 `src/integrations/supabase/types.ts`는 자동 재생성되므로 별도 수정 불필요.
- 위 코드 변경은 마이그레이션 승인·적용 이후 진행 (타입 정합).

## 호환성·롤백
- 구버전 엑셀(`JOB No.`/`Area Code` 등) 임포트는 컬럼 별칭 테이블로 계속 동작.
- DB 컬럼은 rename 방식이라 기존 값 그대로 유지. 롤백이 필요할 경우 역방향 rename 마이그레이션으로 복원 가능.

## 작업 순서
1. DB rename 마이그레이션 실행 (사용자 승인 후).
2. 파서 / columnMap / importRunner / exporter / grid / UI 코드 일괄 수정.
3. 빌드·간단 임포트 검증.
