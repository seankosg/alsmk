## 목표
마일스톤 모니터링 테이블의 Block과 Disc. 컬럼 사이에 **Team** 컬럼을 추가하여 3단 계층(Block → Team → Disc.)으로 표시.

## 매핑
`TEAM_OF_DISCIPLINE` 사용 (예: ARCH→Arch, STR→Civil, MECH/HV→Mech, ELEC/TEL→Elec, FP/FA→FAFP). 정규화는 기존 `normalizeDiscipline` 활용.

## 변경 파일
**`src/components/mdr/MdrMilestoneMonitorPanel.tsx`**

### 1. 데이터 정렬
`displayRows` 를 building → team → discipline 순으로 정렬되도록 보장 (현재 building → discipline). 같은 building 내에서 team 으로 그룹핑이 시각적으로 연속되어야 rowSpan 이 자연스러움.

### 2. 헤더
- `<th rowSpan={3}>Block</th>` 다음에 `<th rowSpan={3} className="text-left px-2 py-1 border-r">Team</th>` 추가.

### 3. 본문 셀
- 현재 `showBlock` + `blockRowSpan` 패턴과 동일하게 `showTeam` + `teamRowSpan` 도입.
- `showTeam` = 이전 행과 비교해 building 이 바뀌었거나 team 이 바뀐 경우 true.
- `teamRowSpan` = 같은 (building, team) 행 개수.
- `<td rowSpan={teamRowSpan} className="px-2 py-0.5 border-r align-top text-xs font-medium">{team}</td>` 렌더.

### 4. colSpan 보정
빈 행 메시지의 `colSpan={99}` 는 그대로 유효(과대 지정이라 OK).

## 기술 메모
- 필터(`filter.t`)로 team 단일 선택 시에도 Team 컬럼은 표시(일관성).
- `MdrSummaryPanel` 등 다른 패널은 변경 없음.
