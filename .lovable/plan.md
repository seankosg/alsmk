## 변경 사항

### 1. TEL, HV 를 ELEC 팀에 매핑 (사용자 명시)
**`src/lib/mdr/weights.ts`**

- `TEAM_OF_DISCIPLINE` 에 `TEL: "ELEC"`, `HV: "ELEC"` 추가.
- `DISCIPLINES_BY_TEAM.ELEC` 를 `["ELEC", "TEL", "HV", "FA"]` 로 확장 (표시 순서).
- `normalizeDiscipline` 에 명시적 케이스 추가:
  - `TEL`, `HV` 는 그대로 통과시키되 분기를 명시(가독성).
  - (참고) 기존 raw 데이터에 `HV`/`TEL` 그대로 존재 — `mdr_drawings` 에서 확인됨.

### 2. Summary 와 Monitor 의 데이터 소스 일치
두 엔진 모두 이미 `mdr_drawings` (out_of_scope=false) + `mdr_milestones/cells/progress` 를 같은 쿼리 패턴으로 로드. 그러나 표시 결과가 달라 보이는 원인은:

- Summary 의 `DISC_ORDER` 와 `DISCIPLINES_BY_TEAM` 가 `HV`/`TEL` 을 모르기 때문에 해당 도면이 어떤 팀에도 매칭되지 않아 누락되거나, "ETC" 로 빠짐.
- Monitor 는 normalize 된 모든 discipline 을 그대로 행으로 렌더 → HV/TEL 행이 보이지만 팀 컬럼이 "—".

→ 위 #1 매핑 추가만으로 양쪽 결과가 같은 도면 모집단·같은 팀 매핑을 사용하게 됨.

**`src/lib/mdr/summaryEngine.ts`**
- `DISC_ORDER` 에 `TEL`, `HV` 포함: `["ARCH", "CIVIL", "STR", "MECH", "FP", "ELEC", "TEL", "HV", "FA", "FAFP"]`.
- (필요 시) `ORDER` 보조 배열에도 추가.

### 3. 검증
변경 후 Summary 의 ELEC 팀 그룹과 Monitor 의 ELEC 팀 rowSpan 묶음이 동일한 도면 수를 표시해야 함.

## 변경하지 않는 것
- DB 스키마, 가중치 테이블 — TEL/HV 도 ELEC 팀 WF(0.11) 를 공유.
- mdr_weights audit/로직.
