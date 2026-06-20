## MDR Raw Data 선택행 일괄 삭제 (하드 삭제)

`MdrBulkActionBar`에 **Delete** 액션을 추가하여 선택된 `mdr_drawings` 행을 연관 자식 행(`mdr_milestones`, `mdr_progress`)과 함께 영구 제거합니다.

### A. 백엔드 — `src/lib/mdr/bulkEdit.ts`
신규 함수 `applyMdrBulkDelete({ ids, userName })` 추가:
- 500행 청크로 분할 (`BULK_CHUNK_ROWS` 재사용)
- 청크당 처리 순서:
  1. `supabase.from("mdr_milestones").delete().in("drawing_id", chunk)`
  2. `supabase.from("mdr_progress").delete().in("drawing_id", chunk)`
  3. `supabase.from("mdr_drawings").delete().in("id", chunk).select("id")`
- 부분 실패 시 누적 카운트 반환 (`{ ok, failed, errors }`)
- 완료 후 `activity_log` 1행 적재:
  `action: "bulk_delete"`, `entity_type: "mdr_drawings"`, `details: { count, failed, sample_ids: ids.slice(0,50) }`

> FK 제약이 없어 자식 행이 고아가 되지 않도록 **자식 먼저 삭제** 순서를 보장합니다.

### B. UI — `src/components/mdr/grid/MdrBulkActionBar.tsx`
1. 우측 액션 영역에 **Delete** 버튼 추가 (`Trash2` 아이콘, `variant="destructive"`)
2. 별도 확인 `Dialog` (`deleteConfirmOpen` 상태):
   - 제목: "선택한 도면 영구 삭제"
   - 설명: `{N}행 영구 삭제 — 복구 불가. 연관 마일스톤/진행률도 함께 제거됩니다.`
   - 미리보기: 첫 5행 `item_no` + `drawing_title` 목록
   - **추가 가드**: 사용자가 입력란에 `DELETE`를 정확히 타이핑해야 실행 버튼 활성화
   - 실행 버튼: 빨간색 (`variant="destructive"`), 로딩 스피너
3. 권한: 기존 `canEdit` (`isAdminOrPm`) 게이트 그대로 사용 — 별도 admin-only 분리 없음
4. 완료 후:
   - `queryClient.invalidateQueries({ queryKey: ["mdr_drawings"] })`
   - `onClearSelection()` 호출
   - `toast`로 성공/실패 결과 표시

### C. 동작 흐름 요약
```text
[선택 N행] → Delete 클릭 → 확인 Dialog → "DELETE" 입력 → 실행
  → 청크별: mdr_milestones / mdr_progress / mdr_drawings 순 삭제
  → activity_log 요약 적재
  → 그리드 재조회 + 선택 해제 + 토스트
```

### D. 검증
1. 빌드/타입체크 통과
2. Admin 계정으로 5행 선택 → Delete → "DELETE" 입력 → 행이 그리드에서 사라지고 `mdr_drawings`/`mdr_milestones`/`mdr_progress`에서 사라지는지 확인
3. "DELETE" 미입력 시 버튼 비활성 확인
4. Guest 계정에서 BulkActionBar 자체 비표시 유지 확인
5. `activity_log`에 `bulk_delete` 1행 적재 확인

### 영향 파일
- `src/lib/mdr/bulkEdit.ts` (함수 추가)
- `src/components/mdr/grid/MdrBulkActionBar.tsx` (Delete 버튼 + 확인 다이얼로그)

### 스키마 변경
없음 (FK·트리거·정책 변경 불필요).
