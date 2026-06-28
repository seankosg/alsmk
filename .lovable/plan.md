## 목표
모든 Discipline의 Team 매핑을 점검하고, 누락/모호 항목을 명시적으로 정리한다.

## 현황 점검 결과

DB `mdr_drawings.discipline` 실제 값 10종 → Team 매핑 결과:

| 원본 | 행수 | normalize | Team | 비고 |
|---|---|---|---|---|
| AR | 1,082 | ARCH | ARCH | 정상 |
| ME | 482 | MECH | MECH | 정상 |
| HV | 214 | HV | MECH | 정상 |
| FP | 57 | FP | MECH | 정상 |
| EL | 924 | ELEC | ELEC | 정상 |
| TEL | 223 | TEL | ELEC | 정상 |
| FA | 26 | FA | ELEC | 정상 |
| STR | 1,049 | STR | STR | 정상 |
| STR - STEEL | 102 | STR (startsWith 우연 일치) | STR | **명시화 필요** |
| GEN | 37 | GEN | (null) | **현행 유지** — 각 동 공통/Overall 도면 분류용. Building WF=0이므로 Overall 합산에서 자연 제외 |

## 변경 사항 (1개 파일만)

### `src/lib/mdr/weights.ts` — `normalizeDiscipline` 정리

1. **STR 정규화 명시화**: `STR -`, `STR_`, `STR ` 등 변형 접두사를 모두 `STR`로 묶는다는 의도를 코드/주석으로 명문화. 동작은 동일하나, 향후 `STR - CONC`, `STR_RC` 등 신규 변형 유입 시 의도된 동작임을 보장.
   - 예: `if (up === "ST" || up === "STR" || up.startsWith("STR ") || up.startsWith("STR-") || up.startsWith("STR_") || up.startsWith("STR")) return "STR";`
   - 주석으로 "STR - STEEL 등 STR 세부분류는 모두 STR팀으로 합산" 명시.

2. **GEN 처리 주석 추가**: `TEAM_OF_DISCIPLINE`에 GEN을 일부러 비워두는 이유를 주석으로 명시 — "GEN은 동/팀 전반 공통 도면 분류로, 특정 팀에 귀속하지 않고 Building WF=0 정책과 함께 Overall 합산에서 제외."

3. **누락 방어**: `normalizeDiscipline` 끝의 폴백 `return up;`은 그대로 두되, 위 매핑되지 않은 신규 코드는 그대로 노출되어 추후 발견되도록 유지(현재 정책과 동일).

## 검증

- 변경 후 `loadMdrWeights`/`summaryEngine` 호출부에 영향이 없는지 빌드만 확인 (로직 동치).
- 진척 패널 STR 값이 변경 전후 동일한지 1회 확인.

## 변경 없음 / 확인된 사항
- Stage WF, Team WF, Building WF 데이터 자체는 변경하지 않음.
- HV→MECH 매핑은 이미 직전 작업에서 반영됨, 재확인 완료.
- CIVIL은 DB에 실데이터 없음, 매핑은 유지(향후 유입 대비).
