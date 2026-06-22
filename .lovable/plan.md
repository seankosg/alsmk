# item_no UNIQUE 제약 해제 + doc_base 부분 유니크 전환

## 결정사항
- `item_no`는 **비고유 표시·검색용** 컬럼으로 강등 (NULL 허용).
- `doc_base`(Plant ID-PBS-FBS-SER.NO.)가 **있는 행**만 건물별 유일성 강제.
- 같은 시트 안에서 `No.`가 반복되어도 `doc_base`가 다르면 별개 도면으로 정상 임포트.

## 작업 항목

### 1. DB 마이그레이션 — 적용 완료 ✅
- `mdr_drawings.item_no` → `NOT NULL` 해제
- `(building_code, item_no)` UNIQUE 제거
- `(building_code, doc_base) WHERE doc_base IS NOT NULL` 부분 UNIQUE 인덱스 추가
- `(building_code, item_no)` 일반 인덱스(조회용) 추가

### 2. 부분 데이터 정리 — 적용 완료 ✅
- 깨진 부분 임포트 잔여분(SMP&CCM 400, HSM 400, CRM 1000, MAIN_OFFICE 등) 일괄 삭제
- 관련 milestones/progress는 FK 캐스케이드, drawing_revisions는 명시적 삭제

### 3. `src/lib/mdr/importRunner.ts` 수정 (남은 작업)
- 매칭 우선순위 변경:
  - `docBase`가 있으면 `existingByDocBase`로만 매칭
  - `docBase`가 없으면(legacy/TBD) `existingByItemNo`로 fallback 매칭
- 파일 내 중복 판정:
  - `docBase` 있는 행 → `seenDocBase`로만 판정 (item_no 중복 허용)
  - `docBase` 없는 행 → `seenItemNo`로 판정
- 로그 reason 메시지 세분화: "파일 내 중복 (Doc No.)" / "파일 내 중복 (Item No.)"

### 4. 영향 점검 (변경 불필요한 곳)
- `DesignImportLogs.tsx`의 item_no 검색/표시: 그대로 동작 (NULL 허용으로 인해 빈 값이 늘어날 뿐 충돌 없음)
- `MdrAdvancedGrid` 컬럼·검색 hay: 그대로 유지
- `exporter.ts` 엑셀 출력: 그대로 유지
- `parser.ts`의 itemNo 생성 로직: 그대로 유지 (`${building}-${discipline}-${sourceNo}`)

## 검증
1. 02/03/04/05 MDR 엑셀 4개를 다시 임포트
2. 임포트 로그에 Failed 없이 Inserted/Skipped 카운트로 마감되는지 확인
3. DesignManagement 그리드에서 각 건물별 도면 수가 엑셀 시트 합계와 일치하는지 확인
