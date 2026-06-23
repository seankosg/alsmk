# 통합 Plan — Raw Data Grid 최적화 + SD/DD/CD 목표완료일 + 원본 양식 내보내기

## 1) 컬럼 구조 변경 (옵션 1+3)
**SD/DD/CD 단계마다 트리오 [Planned% / Actual% / Δ]** 로 통합. 기존 DD30/60/90/100, CD30/60/100 세부 마일스톤 컬럼은 유지하되 **기본 숨김**, "Columns" 팝업에서 토글 가능.

- 트리오 앞에 **SD목표완료일 / DD목표완료일 / CD목표완료일** 컬럼 신설(기본 표시).
- 정의: 각 단계 **누계 100% 마일스톤의 plan_date**. 컬럼은 기존 `mdr_drawings.stage_plan_sd/dd/cd` 재사용.
- Δ = **Actual − Planned (A−P)**
  - 음수 → 붉은색 (공정지연)
  - 양수 → 푸른색 (선행)
  - 0 → 기본 색
  - 표기는 "+3 / −5" 등 부호 포함.

## 2) 컬럼 위치 이동 (사용자별 로컬 저장)
- dnd-kit 로 헤더 leaf 드래그 reorder.
- 같은 상위 그룹(SD/DD/CD 트리오, 식별자 그룹) 내부에서만 이동 허용 → contiguous 보장.
- 신규 컬럼 추가 시 자동 append, 정의 변경 시 sanitize.
- 사용자별 localStorage 영속: `mdr-raw-grid-state:${user.id}:${building}:${sheet}` 의 `columnOrder` 키.
- Columns 팝업에 "컬럼 순서 초기화" 버튼.

## 3) SD/DD/CD 목표완료일 — 1회 백필 + 자동 동기화
현재 `mdr_drawings.stage_plan_sd/dd/cd` 는 전 행 NULL (총 4460행). `mdr_milestone_cells` 에 단계별 `pct=100` 행이 존재 (SD 365, DD 8257, CD 17562).

**(a) 1회 백필** (data UPDATE, insert tool):
```sql
UPDATE public.mdr_drawings d
SET stage_plan_sd = sub.plan_date
FROM (SELECT drawing_id, MIN(plan_date) plan_date
      FROM public.mdr_milestone_cells
      WHERE stage='SD' AND pct=100 GROUP BY drawing_id) sub
WHERE d.id = sub.drawing_id AND d.stage_plan_sd IS DISTINCT FROM sub.plan_date;
-- DD, CD 동일 패턴
```

**(b) 자동 동기화 trigger** (migration tool):
`mdr_milestone_cells` INSERT/UPDATE/DELETE 시 영향 받는 `(drawing_id, stage)` 의 pct=100 plan_date 를 `stage_plan_xx` 로 재계산.

```sql
CREATE OR REPLACE FUNCTION public.sync_stage_plan_date()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_drawing uuid := COALESCE(NEW.drawing_id, OLD.drawing_id);
  v_stage  text := COALESCE(NEW.stage, OLD.stage);
  v_date   date;
BEGIN
  SELECT MIN(plan_date) INTO v_date FROM mdr_milestone_cells
  WHERE drawing_id=v_drawing AND stage=v_stage AND pct=100;
  IF v_stage='SD' THEN UPDATE mdr_drawings SET stage_plan_sd=v_date WHERE id=v_drawing;
  ELSIF v_stage='DD' THEN UPDATE mdr_drawings SET stage_plan_dd=v_date WHERE id=v_drawing;
  ELSIF v_stage='CD' THEN UPDATE mdr_drawings SET stage_plan_cd=v_date WHERE id=v_drawing;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_sync_stage_plan_date
AFTER INSERT OR UPDATE OR DELETE ON public.mdr_milestone_cells
FOR EACH ROW EXECUTE FUNCTION public.sync_stage_plan_date();
```

이후 parser/importRunner 는 별도 계산 없이 trigger 가 자동 채움.

## 4) 원본 엑셀 양식 그대로 내보내기 (round-trip)
앱에서 수정·추가된 모든 값이 사용자가 익숙한 임포트 양식 그대로 반영되어 내보내짐.

- `mdr_drawings.raw_row_cells jsonb` 신설 (헤더명 → 셀값).
- `parser.ts` : 행마다 모든 헤더 셀을 수집해 `rawRowCells` emit.
- `importRunner.ts` : insert / rev_update / skip_same_rev 3 경로 모두 `raw_row_cells` upsert.
- `exporter.ts` 우선순위:
  1. 마일스톤 Y/N · Building · Item No. (기존 처리)
  2. 앱 관리 필드(목표완료일, Confirmed By, IFR/IFC, Document Class 등) — `detectColumnKey` 로 헤더 매칭해 DB값으로 override
  3. 기존 행 미인식 컬럼 → 템플릿 원본 유지
  4. 신규 도면 → 템플릿 마지막에 append, 컬럼은 `raw_row_cells` 폴백
  5. 스타일·병합·열폭 보존

## 변경 파일
- migrations (trigger), insert tool (백필 UPDATE 3건)
- `src/lib/mdr/parser.ts`, `importRunner.ts`, `exporter.ts`
- `src/components/mdr/grid/columns.tsx`, `MdrAdvancedGrid.tsx`, `useGridStatePersistence.ts`
- `package.json` (dnd-kit 이미 설치됨 — 확인만)

**변경 없음:** `progressEngine.ts`, `summaryEngine.ts`, `progressIcon.ts`, `bulkEdit.ts`, `columnMap.ts`

## 검증
- 트리오 표시 + Δ 색상(음수 빨강, 양수 파랑) + 세부 마일스톤 기본 숨김.
- 목표완료일 3컬럼이 트리오 앞에 표시되고 백필 후 SD 365 / DD 8257 / CD 17562 행이 값 보유.
- 마일스톤 셀 편집 → 목표완료일 자동 갱신 (trigger).
- 컬럼 드래그 reorder 후 새로고침해도 사용자별 순서 유지.
- 기존 양식 내보내기 → 앱 수정값 반영 + 미인식 컬럼·서식 보존, 신규 도면 append 확인.
