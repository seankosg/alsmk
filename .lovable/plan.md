## 문제
Import 실행 시 GEN(37건)은 성공했지만 SMP&CCM/HSM/CRM/MAIN_OFFICE는 모두 다음 오류로 실패:

```
duplicate key value violates unique constraint "mdr_drawings_building_doc_base_unique"
```

## 원인
DB에 `(building_code, doc_base) WHERE doc_base IS NOT NULL` 유니크 인덱스가 **2개** 존재합니다:

- `mdr_drawings_building_doc_base_unique`
- `mdr_drawings_building_doc_base_uidx`

이전 검증에서 확인했듯이, 원본 MDR 엑셀에는 **같은 docBase가 정상적으로 여러 행에 매핑되는 케이스**가 존재합니다 (예: CRM의 `L8B1-820-EB130-002` → PIPING PLAN 2F/4F). 즉 `doc_base`는 본질적으로 유니크 키가 아닙니다.

직전 작업에서 `importRunner.ts`는 dedup·매칭 기준을 `item_no`로 일원화했지만, DB 레벨의 유니크 인덱스 2개가 그대로 남아있어 INSERT가 거부됩니다.

## 수정 사항

### 1. 유니크 인덱스 2개 DROP (migration)

```sql
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_unique;
DROP INDEX IF EXISTS public.mdr_drawings_building_doc_base_uidx;
```

### 2. `(building_code, item_no)` 유니크 인덱스 추가

dedup·매칭 기준이 itemNo로 통일되었으므로 DB 레벨에서도 itemNo가 유니크여야 합니다. 현재 `mdr_drawings_building_item_no_idx`는 비-유니크 인덱스이므로 유니크 인덱스로 교체합니다.

```sql
DROP INDEX IF EXISTS public.mdr_drawings_building_item_no_idx;
CREATE UNIQUE INDEX mdr_drawings_building_item_no_uidx
  ON public.mdr_drawings (building_code, item_no);
```

### 3. `doc_base`에 비-유니크 조회 인덱스 추가 (옵션)

조회 성능 유지용:
```sql
CREATE INDEX IF NOT EXISTS idx_mdr_drawings_building_doc_base
  ON public.mdr_drawings (building_code, doc_base)
  WHERE doc_base IS NOT NULL;
```

### 4. GEN의 부분 import 데이터 삭제 후 재import

GEN 37건은 이미 들어갔지만 5개 파일을 일관성 있게 재import하려면 동일 building의 기존 데이터를 비웁니다:

```sql
DELETE FROM public.mdr_drawings WHERE building_code = 'GEN';
```

(다른 빌딩은 0건이므로 영향 없음)

## 실행 순서
1. Migration 실행 (인덱스 변경 + GEN 삭제)
2. UI에서 6개 파일 전체 다시 import
3. 모든 파일이 `Done` 상태로 표시되고 `Inserted` 카운트가 검증 결과(37/1209/973/2008/230/83 = 총 4,540)와 일치하는지 확인

## 영향 범위
- DB 인덱스 구조만 변경, 컬럼·정책·트리거 변경 없음
- 코드 변경 없음 (parser/importRunner는 이미 수정 완료된 상태 사용)