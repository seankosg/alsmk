## 컬럼 드래그 그룹 가드 제거

`MdrAdvancedGrid.tsx`의 `onReorder` 핸들러에서 1단/2단 컬럼 간 이동을 막던 group-guard 블록을 제거합니다.

### 변경 내용
- `__select__` 보호는 유지
- 그룹(SD/DD/CD) 간 cross-group 이동 차단 로직 제거
- `sanitizeColumnOrder`가 그룹 leaf(P/A/Δ)를 자동으로 인접 재배치하므로:
  - 1단 컬럼 → 그룹 사이로 드래그 시 그룹 옆에 위치
  - 그룹 leaf → 그룹 밖으로 드래그 시 그룹 전체가 함께 이동

### 변경 파일
- `src/components/mdr/grid/MdrAdvancedGrid.tsx` (onReorder 핸들러만)

### 검증
- 1단 컬럼을 SD/DD/CD 사이로 이동 가능
- 그룹 leaf를 밖으로 이동 시 그룹 전체 함께 이동
- 새로고침 후 localStorage 순서 복원 정상
