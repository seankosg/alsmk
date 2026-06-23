## 변경 요약

이전 plan(옵션 1+3, SD 트리오 기본 숨김, dnd-kit reorder)을 유지하면서 두 가지 추가:

1. **목표완료일 컬럼을 단계 요약 트리오 직전에 배치 + 기본 표시**
2. **원본 엑셀 양식 그대로 내보내기** — 사용자 편집/업데이트가 모두 반영되되, **임포트했던 엑셀과 동일한 양식(스타일·열·헤더·서식)** 으로 변환

---

## 1) 컬럼 배치

기존 `stage_plan_sd/dd/cd` 컬럼 재활용 (DB/파서/임포터 변경 없음). 헤더 라벨만 변경, 위치 이동, 기본 표시.

```text
... Title │ SD │ DD │ CD (mark)
       │ SD목표완료일 │ DD목표완료일 │ CD목표완료일
       │ ┌── SD ──┐ ┌── DD ──┐ ┌── CD ──┐  Overall%
            P│A│Δ     P│A│Δ     P│A│Δ
       │ [세부 마일스톤 컬럼들 (DD30/60/90/100, CD30/60/100 의 계획일·실적일·P·A·Δ — 기본 숨김)]
       │ Plan Finish │ Updated │ ...
```

- 헤더: `SD Plan` → "SD목표완료일", `DD Plan` → "DD목표완료일", `CD Plan` → "CD목표완료일"
- 위치: SD/DD/CD 그룹 헤더 직전
- 기본 visibility: **표시**(기존 숨김에서 변경)
- DD/CD 중간 마일스톤 세부 컬럼은 기본 숨김 유지
- dnd-kit reorder 규칙 동일 적용

---

## 2) "원본 양식 그대로 내보내기" 의 정의

> 사용자가 임포트한 엑셀과 **동일한 시트 레이아웃·헤더·열 너비·셀 스타일·머지·서식**을 유지하면서, **앱에서 수정·추가된 모든 값**(마일스톤 Y/N, 목표완료일, 상태 마크, 메타 필드 등)을 해당 위치에 덮어쓴 결과물.

### 현재 구현 (`exporter.ts`) 의 한계
- 양식 보존: `mdr_buildings.template_blob` 를 `xlsx-js-style` 로 로드하여 스타일·머지 모두 보존 ✅
- 값 반영 범위: NO 컬럼으로 행 매칭 후 **마일스톤 Y/N + Building + Item No.** 만 덮어씀 → 나머지 앱에서 편집한 필드(목표완료일, Confirmed By, IFR/IFC 일자, Document Class 등)는 **반영 안 됨** ❌
- 신규 import 후 추가된 도면(템플릿 원본 시트에 행이 없는 도면) → 시트에 **누락** ❌

### 해결

**(A) 앱 관리 필드 전체를 export 에 반영**

`exporter.ts` `MdrExportDrawing` 확장:
```ts
{
  sourceNo, building, itemNo, ...,         // 기존
  stagePlanSd?, stagePlanDd?, stagePlanCd?,
  confirmedBy?, ifrStart?, ifrIssue?, ifcStart?, ifcIssue?,
  documentClass?, docClassCode?,
  // 등 columnMap.ts 의 preserveOnReimport: true 필드 전체
}
```

`patchSheet` 헤더 스캔에 `detectColumnKey` 사용 → 인식된 컬럼키에 해당하는 drawing 필드 값을 덮어씀. 마일스톤(SD/DD/CD %) 은 별도 정규식 매칭 유지. 스타일은 기존 셀의 `s` 그대로 보존.

**(B) 신규 도면 행 append**

NO 매칭 실패한 도면 = 템플릿에 원본 행이 없는 신규 추가분. 템플릿의 마지막 데이터 행 직후에 새 행을 append:
- 직전 행의 스타일을 셀별로 복사하여 시각적 일관성 유지
- 모든 인식 컬럼에 drawing 필드 값을 set
- `!ref` 범위 확장

**(C) 원본 미인식 컬럼 round-trip 보존**

앱이 모델링하지 않는 컬럼(예: 사용자가 임포트 엑셀에 임의 추가한 비고/메모 열)을 신규 도면 행에서도 비어버리지 않도록:

**DB 마이그레이션 (신규)** — `mdr_drawings` 에 `raw_row_cells jsonb` 추가
```sql
ALTER TABLE public.mdr_drawings
  ADD COLUMN raw_row_cells jsonb;
COMMENT ON COLUMN public.mdr_drawings.raw_row_cells IS
  '엑셀 원본 행의 미인식 셀 값(헤더→값). round-trip 내보내기 보조';
```
RLS/GRANT 변경 없음.

**parser.ts**: 각 데이터 행에서 `detectColumnKey` 로 매핑되지 않거나 마일스톤 헤더가 아닌 컬럼만 `{ 헤더: 값 }` 로 수집 → `rawRowCells` emit.

**importRunner.ts**: 3개 insert 경로 모두 `raw_row_cells` upsert.

**exporter.ts**: 헤더가 앱 관리 필드도 마일스톤도 아닐 때 → `rawRowCells[header]` 값을 set (기존 도면 행은 어차피 템플릿 값이 살아있으므로 신규 append 행에만 의미가 있음).

---

## 3) 우선순위 규칙 (export 시 셀 값 결정)

1. **마일스톤 Y/N**: drawing.progress (DB) 가 항상 우선 (앱 편집 우선)
2. **앱 관리 컬럼**(Building, Item No., 목표완료일, Confirmed By, IFR/IFC 등): drawing 필드 (DB) 가 항상 우선
3. **그 외 컬럼**: 기존 행은 템플릿 원본 유지, 신규 append 행은 `rawRowCells` 폴백
4. **스타일/머지/열폭/시트 메타**: 항상 템플릿 원본 그대로

---

## 4) 영향 파일

**신규 / 변경**
- `supabase/migrations/<new>.sql` — `raw_row_cells jsonb` 추가
- `src/lib/mdr/parser.ts` — `rawRowCells` emit
- `src/lib/mdr/importRunner.ts` — `raw_row_cells` upsert
- `src/lib/mdr/exporter.ts` — `MdrExportDrawing` 확장, `detectColumnKey` 기반 전 필드 덮어쓰기, 신규 도면 행 append, raw 폴백
- `src/components/mdr/grid/columns.tsx` — SD/DD/CD 트리오 + 그룹 헤더, 목표완료일 라벨 변경·위치 이동·기본 표시
- `src/components/mdr/grid/MdrAdvancedGrid.tsx` — 트리오 산정(누계 A), dnd-kit reorder, 쿼리에 `raw_row_cells` 포함, export 호출부에서 전 필드 + rawRowCells 전달
- `src/components/mdr/grid/useGridStatePersistence.ts` — `columnOrder` 영속화
- `package.json` — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `src/integrations/supabase/types.ts` — 자동 재생성

**비변경**: `progressEngine.ts`, `summaryEngine.ts`, `progressIcon.ts`, `bulkEdit.ts`, `columnMap.ts`

---

## 5) 검증

1. SD/DD/CD 목표완료일 컬럼이 트리오 그룹 헤더 직전에 표시되고 기본 visible, 헤더 라벨 일치
2. dnd-kit 위치 이동 → 새로고침 시 사용자별 순서 유지
3. 앱에서 목표완료일/Confirmed By 등 수정 → export 시 해당 셀이 새 값으로 반영
4. 마일스톤 Y/N 변경 → export 시 반영, SD 는 항상 Y
5. 신규 import 로 추가된 도면 → export 시 시트 하단에 행 append, 스타일·모든 컬럼 채워짐
6. 임의 추가 컬럼(비고 등) → 기존 행은 원본 유지, 신규 행은 `rawRowCells` 값으로 채워짐
7. 시트 스타일/머지/열폭/서식이 원본과 동일
8. export 한 파일을 다시 import → 데이터 손실 없이 round-trip
