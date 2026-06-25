## 목표
마일스톤 모니터링 테이블의 건물 순서를 고정하고, 공장동 소계행 추가 + 전체 합계 의미를 "프로젝트 전체(공장동 + Main Office)"로 명확화. FAFP/MAIN_OFFICE 순서를 교체.

## 건물 분류 정의 (사용자 확정)
- **공장동 (5개)**: GEN, SMP&CCM, HSM, CRM, FAFP
- **사무동 (1개)**: MAIN_OFFICE
- **프로젝트 전체** = 공장동 + 사무동

## 변경 사항

### 1. 건물 정렬 순서 고정 — `MdrMilestoneMonitorPanel.tsx`
`displayRows` 정렬에서 first-seen 기반 `buildingOrder` 대신 고정 순서 사용:

```
GEN → SMP&CCM → HSM → CRM → FAFP → MAIN_OFFICE → (그 외)
```

### 2. 합계행 3단계 계층 구조

테이블 본문 출력 순서:

```
[GEN 행들...]
  └ GEN 합계                 (연한 주황 — 기존)
[SMP&CCM 행들...]
  └ SMP&CCM 합계
[HSM 행들...]
  └ HSM 합계
[CRM 행들...]
  └ CRM 합계
[FAFP 행들...]
  └ FAFP 합계
  └ 공장동 합계              (중간 톤 주황 — 신규)
[MAIN_OFFICE 행들...]
  └ MAIN_OFFICE 합계
  └ 프로젝트 전체            (진한 주황 — 기존 "전체 합계" 라벨/색 변경)
```

- 공장동 합계는 FAFP 건물 소계 직후 1회 삽입 (FAFP가 공장동의 마지막일 때).
- 필터로 공장동 건물이 일부만 보이면 보이는 행만으로 집계.
- MAIN_OFFICE가 필터로 제외되면 "프로젝트 전체" 라벨을 "공장동 합계"와 동일한 값으로 표시하지 않고, 그대로 displayRows 전체 합계로 출력 (실질적으로 공장동 합계와 같아짐).

### 3. 스타일 (3단계 톤 계조)
- 건물 소계 (기존): `bg-orange-100/80 dark:bg-orange-900/30 font-semibold`
- 공장동 합계 (신규 중간 톤): `bg-orange-200/80 dark:bg-orange-900/45 font-semibold` + 상하 강조 보더
- 프로젝트 전체 (기존 grand 변경): `bg-orange-300/80 dark:bg-orange-900/60 font-bold` + 굵은 상하 보더

### 4. 라벨 변경
- "전체 합계" → "프로젝트 전체"
- 신규 "공장동 합계"

### 5. 메모리 업데이트
`mem://project/building-categories` 의 공장동 정의를 (SMP&CCM, HSM, CRM) → (GEN, SMP&CCM, HSM, CRM, FAFP) 로 수정. MAIN_OFFICE만 사무동으로 분류, 프로젝트 전체 = 공장동+사무동 규칙 추가.

## 변경 파일
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` — 정렬 순서 고정 + `renderAggRow` variant 3종(`building`/`factory`/`grand`) 처리 + 본문 map 에서 공장동 마지막 건물 직후 공장동 합계 삽입
- `.lovable/memory/project/building-categories.md` — 분류 정의 갱신
- `.lovable/memory/index.md` — 설명 수정
