## 결론: 추가 코드 변경 불필요

업로드하신 5개 파일을 모두 점검한 결과, **헤더 구조가 이전에 수정한 `02_SMP&CCM` 파일과 완전히 동일한 템플릿**입니다. 직전 턴에서 `parser.ts`에 적용한 row 4 + row 5 결합 인식 로직(`headerTextAt`)이 그대로 적용됩니다.

## 점검 결과 요약

| 파일 | 시트 | row 4 | row 5 (서브헤더) | 정상 인식 |
|---|---|---|---|---|
| 01_GEN | ARCH | `NO. \| DISCIPLINE \| DWG.NO(병합) \| … \| ACTIVITY GROUP \| TITLE \| SD \| DD \| CD \| SD50%…` | `PLANT ID \| PBS \| FBS \| SER.NO. \| REV.NO.` | ✅ |
| 03_HSM | ARCH/STR/MECH/ELEC | 동일 (SD/DD/CD가 `SD Stage` 형태) | 동일 | ✅ |
| 04_CRM | ARCH/STR/MECH/ELEC | 동일 | 동일 | ✅ |
| 05_MAIN_OFFICE | ARCH/STR/MECH/ELEC | 동일 | 동일 | ✅ |
| 06_FAFP | `MDR (Drawing)_FA,FP` | 동일 | 동일 | ✅ |

샘플 데이터 행 검증 (각 파일 row 8 기준):

- 01_GEN ARCH → `L0Z1-800-EA100-001-B`
- 03_HSM ARCH → `L4A1-800-EA100-001-B`
- 03_HSM STR → `L4A1-800-ES100-1-B`
- 04_CRM ARCH → `L8Z1-800-EA100-1-B`
- 04_CRM MECH → `L8Z1-810-EB110-1-B`
- 05_MAIN_OFFICE STR → `L0B1-811-EL100-1-B`
- 06_FAFP `MDR (Drawing)_FA,FP` row 8 → 4토큰 모두 `TBD` → 기존 PLACEHOLDER 정책에 따라 `__UNKNOWN__-MDR (Drawing)_FA,FP-9` fallback (정상 동작)

## 06_FAFP 파일 특이사항 (의도된 동작)

해당 파일은 데이터 행 자체가 `PLANT ID/PBS/FBS/SER.NO.` 컬럼에 `TBD` 문자열을 채워 출고된 미정 상태입니다. 이는 헤더 매핑 문제가 아니라 **원본 데이터에 식별값이 없는 것**이며, `parser.ts`의 `PLACEHOLDER_RE`(`tbd|tba|n/a|na|미정|tbc|-`)가 빈 토큰으로 정규화 → `__UNKNOWN__-{sheet}-{row}` fallback이 발동됩니다. 추후 엑셀 셀에 실제 값이 들어오면 재임포트 시 정상 Doc. No.로 덮어써집니다.

## 추가 작업 없음

5개 파일 모두 직전 수정으로 정상 Doc. No. 생성이 보장되므로, 코드 변경·DB 마이그레이션 모두 불필요합니다. **재임포트만 수행**하시면 됩니다.

이 결론에 동의하시면 "approve"로 확정해 주세요. 만약 06_FAFP의 `TBD` 행도 의미 있는 Doc. No.를 갖도록 별도 정책(예: TBD를 그대로 유지)을 원하시면 그 부분만 별도 plan으로 추가 작성할 수 있습니다.
