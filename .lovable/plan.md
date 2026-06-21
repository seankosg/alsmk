## 원인
- Raw Data 그리드에 B~F 식별 컬럼이 정의돼 있지 않아 화면에 안 보임 (DB에는 저장됨).
- `function_code`는 엑셀 헤더가 "Fuction Code"(오타)라 파서 매칭 후보(`"Function"`/`"FUNCTION"`)와 일치하지 않아 빈 값으로 저장됨.

## 변경 사항

### 1. 파서 — `src/lib/mdr/parser.ts`
`functionCode`의 `findVal` 후보에 `"FUCTION"` 추가:
```ts
functionCode: findVal("Function Code", "FUNCTION", "FUCTION"),
```

### 2. Raw Data 그리드 — `src/components/mdr/grid/columns.tsx`
`MdrDrawingRow` 타입과 컬럼 정의에 5개 식별 컬럼 추가 (Disc. 다음 위치, 기본 표시·정렬·텍스트 필터):
| accessorKey | header | size |
|---|---|---|
| `job_no` | Job No. | 90 |
| `area_code` | Area | 70 |
| `function_code` | Func. | 80 |
| `serial_no` | Serial | 80 |
| `activity_group` | Activity Group | 130 |

### 3. 그리드 데이터 SELECT — `src/components/mdr/MdrRawDataGrid.tsx` (또는 `DesignManagement.tsx`)
`mdr_drawings` SELECT에 `job_no, area_code, function_code, serial_no, activity_group` 누락 시 추가하고 행 매핑에 포함.

### 4. 기존 데이터 정리 — 옵션 A (사용자 선택)
사용자가 잘못 임포트된 배치를 재임포트할 수 있도록:
- `/design/import/logs` 화면에서 SMP&CCM 빌딩의 기존 import 배치/도면을 삭제하는 액션 안내 (또는 사용자가 직접 삭제 후 재임포트).
- 코드 변경 후 동일 엑셀을 재업로드하면 `function_code`까지 정상 저장됨.

> 데이터 삭제는 마이그레이션이 아닌 별도 수동 실행 영역이므로, 코드 배포 완료 후 진행 절차를 안내합니다 (필요 시 별도 요청으로 SMP&CCM 도면 일괄 삭제를 수행).

## 영향 파일
- `src/lib/mdr/parser.ts`
- `src/components/mdr/grid/columns.tsx`
- `src/components/mdr/MdrRawDataGrid.tsx` 또는 `src/pages/DesignManagement.tsx` (SELECT 보강)

## 비범위
- 다른 헤더 오타에 대한 광범위 정규화 (지금은 "Fuction"만 허용).
- 컬럼 표시/숨김·순서 변경 UI는 기존 동작 사용.
