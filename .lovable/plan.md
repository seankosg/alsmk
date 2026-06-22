## 목적
FAFP MDR 파일(`06_FAFP_MDR_Progress-2.xlsx`)의 시트명이 `MDR (Drawing)_FA,FP` 형태여서 현재 파서가 discipline을 `"MDR"`로 잘못 추출하는 문제를 해결합니다. 다른 4개 파일(GEN, SMP&CCM, HSM, MAIN OFFICE)은 헤더 구조가 동일하여 이번 수정으로 영향을 받지 않습니다.

## 근본 원인
`src/lib/mdr/parser.ts` line 142:
```ts
const discipline = sheetName.toUpperCase().split(/[_\-\s]/)[0];
```
- `"MDR (Drawing)_FA,FP"` → split 결과 첫 토큰 = `"MDR"` (실제 의도: `FA,FP`)
- 이 값이 `itemNo` 생성(`${building}-${discipline}-${sourceNo}`)과 시트 메타데이터로 사용되므로, 잘못된 키가 DB에 들어갑니다.

## 해결 방안

### 1. 시트명 기반 discipline 추출 로직 개선 (`parser.ts`)
새 헬퍼 `extractDisciplineFromSheetName(sheetName)` 추가:
- **규칙 1**: `MDR` 접두/관련 토큰(`MDR`, `DRAWING`, `DWG`, `PROGRESS`)은 무시
- **규칙 2**: 괄호 `(...)` 안 내용도 무시 (예: `(Drawing)`)
- **규칙 3**: 남은 토큰들 중 첫 번째 의미있는 토큰을 discipline으로 채택
- **분리자**: `_`, `-`, 공백 (쉼표 `,`는 보존 → `FA,FP` 유지)

예시 결과:
| 시트명 | 기존 | 개선 |
|---|---|---|
| `MDR (Drawing)_FA,FP` | `MDR` | `FA,FP` |
| `MDR_GEN` | `MDR` | `GEN` |
| `Electrical_MDR` | `ELECTRICAL` | `ELECTRICAL` |
| `HVAC` | `HVAC` | `HVAC` |

### 2. 컬럼 값 우선 사용 (보조 안전장치)
`parseSheet` 내부에서 첫 데이터 행의 `DISCIPLINE` 컬럼 값이 존재하면 그것을 시트 discipline으로 우선 채택. 시트명 파싱은 폴백으로 사용. 이렇게 하면 향후 시트명이 어떻게 바뀌어도 헤더 데이터 기반으로 안정적으로 동작합니다.

### 3. 검증
- 5개 업로드 파일을 로컬에서 다시 파싱하여 각 시트의 discipline이 의도된 값(`GEN`, `SMP&CCM`, `HSM`, `MAIN_OFFICE`, `FA,FP` 등)으로 추출되는지 확인
- 기존 CRM 파일에 회귀 없음을 확인

## 영향 범위
- 수정 파일: `src/lib/mdr/parser.ts` 1개 (헬퍼 추가 + line 142 교체 + DISCIPLINE 컬럼 우선 적용 로직)
- DB 스키마 변경 없음
- 이미 import된 데이터에는 영향 없음(다음 import부터 적용)

## 작업 단계
1. `parser.ts`에 `extractDisciplineFromSheetName` 헬퍼 추가
2. `parseSheet` line 142를 새 헬퍼 호출로 교체
3. 첫 데이터 행 `DISCIPLINE` 컬럼 값이 있으면 시트 discipline 덮어쓰기
4. 5개 파일 로컬 파싱 검증
5. 사용자에게 재import 안내