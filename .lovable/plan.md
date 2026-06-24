# 계획 (확정본 v2): STR DD 3단계 파싱 + 마일스톤 모니터링 테이블 + 단계 순차 제약

## 0. 도메인 메모 (빌드 모드 전환 후 저장)
- 건물 분류 — General(공통), 공장동(SMP&CCM/HSM/CRM), 사무동(Main Office) → `mem://project/building-categories`
- 단계 흐름 — **SD → DD → CD → IFR/IFA → IFC**, 선행 미완료 시 후행 착수 불가 → `mem://features/mdr/stage-flow`

## 1. 단계 흐름 적용 — 방향 B 확정
- **진도 계산 대상**: SD / DD / CD (기존 그대로 유지)
- **IFR/IFA, IFC**: stage 로 승격하지 않음. 기존 메타 날짜 컬럼 유지, 모니터링 패널에서 “발행 이정표(Issue milestone)” 로 별도 영역에 표기(읽기 전용).
- **순차 제약 (계산 단에서 강제)**: 선행 단계/셀이 100% 완료되지 않으면 후행 셀의 Y 를 무시.
  - SD pct 오름차순 → DD pct 오름차순(STR DD 의 Information(30) → STR Analysis(60) → Drawings(100) 포함) → CD pct 오름차순.
  - 저장(쓰기) 단 검증은 후속 작업으로 분리. 본 계획은 표시·계산 강제만.

## 2. STR DD 파싱 (확정)
| STR row 5 라벨 | stage | pct |
|---|---|---|
| Information | DD | 30 |
| STR Analysis | DD | 60 |
| Drawings | DD | 100 |
| Progress | — | (제외) |

- 상수 `STAGE_UNLABELED_PCTS = { 1:[100], 2:[50,100], 3:[30,60,100], 4:[30,60,90,100] }`.
- `MdrMilestoneCellDef.label?: string` 추가, row 5 원본 라벨 보존.
- 파서는 row 4 가로 병합 라벨(SD/DD/CD)로 stage 영역 식별.

## 3. DB 마이그레이션
1. `ALTER TABLE public.mdr_milestone_cells ADD COLUMN IF NOT EXISTS label text;`
2. 신규 `public.mdr_milestone_snapshots`
   - `id uuid pk, as_of date, building text, discipline text, stage text, pct int, plan_date date, plan_pct numeric, actual_pct numeric, delta_pct numeric, computed_at timestamptz default now()`
   - UNIQUE(as_of, building, discipline, stage, pct)
   - GRANT authenticated SELECT/INSERT/UPDATE/DELETE, service_role ALL
   - RLS: `auth.uid() is not null` 로 인증 사용자 read/write.

## 4. 코드 변경
- `src/lib/mdr/parser.ts` — §2 적용 + 셀 `label` 저장.
- `src/lib/mdr/stageFlow.ts` (신규) — `enforceSequential(progress, milestones, cells)` : 직전 셀 미완료 시 후행 셀 isDone=false 로 강제.
- `src/lib/mdr/progressEngine.ts`
  - `actualPct` 가 내부에서 `enforceSequential` 호출.
  - `actualPctUpTo(milestones, progress, stage, pct, cells)` 신설 — (stage,pct) 이하 셀만 합산.
- `src/lib/mdr/milestoneMonitorEngine.ts` (신규) — 도면→블록 가중평균, 스냅샷 read/upsert, 전체/증분.
- `src/components/mdr/MdrMilestoneMonitorPanel.tsx` (신규).
- `src/pages/DesignSummary.tsx` — `<MdrMilestoneMonitorPanel />` 추가.

## 5. 마일스톤 모니터링 패널 (헤더 사양 — 확정)
- 행: 기존 Summary 와 동일한 Block × Discipline 골격.
- 컬럼 3단:
  - **1단 (stage)**: SD / DD / CD (가로 병합)
  - **2단 (마일스톤 날짜)**: 각 시트 row 7 의 plan_date 를 그대로 표시 — 부문(disciplines) 마다 날짜가 다르면 합집합 컬럼을 모두 노출하고, 해당 부문 셀이 없으면 `—`. STR DD 의 경우 row 5 라벨(Information/STR Analysis/Drawings)을 날짜 위 작은 캡션으로 부기.
  - **3단 (지표)**: P / A / Δ 의 3개 하위 컬럼.
- IFR/IFA, IFC: 표 우측에 별도 영역 — 도면별 메타 날짜 요약(발행 여부 배지 + 순서 위반 경고).
- 좌상단: 기준일 DatePicker(기본 오늘) + **[신규 계산]** 버튼.
  - 일반 로드: 최신 snapshot 표시 + 기준일 직후 1개 마일스톤만 재계산.
  - [신규 계산]: 전체 재계산 후 snapshot upsert.

## 6. 계산 규칙 (요약)
- **Plan(P)**: 도면 단위 `drawingMilestonePlannedPct(... , asOf)` (일할), 블록·부문 집계는 도면 가중평균(`mdr_weights`).
- **Actual(A)**: `actualPctUpTo` (순차 가드 통과 셀의 incrementPct 누계).
- **Δ**: A − P.
- SD = (현 로직대로) 항상 P=A=100.

## 7. 작업 순서
1. 마이그레이션(label + snapshot).
2. parser 보정 → 4개 파일 재임포트 → SQL 로 STR DD 30/60/100 셀·plan_date 검증.
3. `stageFlow.ts` + `progressEngine` 가드/UpTo 적용 → 기존 그리드·Summary 회귀 확인.
4. `milestoneMonitorEngine` + 패널 + DesignSummary 통합 → Playwright 로 헤더 3단(날짜 합집합), 기본 행/IFR-IFC 배지 확인.
5. [신규 계산] · snapshot 캐시 · 증분 갱신 확인.
6. 메모리 2건 저장.
