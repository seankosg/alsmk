## 헤더 디자인 개선 (1단 가운데 정렬 + 시인성 강화)

### 현재 상태
`SortableHeaderCell` (MdrAdvancedGrid.tsx 154~222) 및 placeholder `<th>` (910~916) 모두 동일한 `hsl(var(--muted))` 배경 + `text-left` + `font-medium` 으로 렌더됨. 결과:
- 1단 그룹 헤더(SD / DD / CD / Overall) 와 2단 leaf 헤더(P / A / Δ) 가 동일한 톤이라 구조가 잘 안 보임
- 그룹 헤더 라벨이 왼쪽에 붙어 하위 컬럼 그룹의 중앙성이 약함

### 변경 사항
`SortableHeaderCell` 내부에서 `isGroup = header.subHeaders.length > 0` 로 분기하여 1단/2단 스타일 분리.

#### 1단(그룹 헤더) — SD · DD · CD · Overall
- 정렬: `text-center`, 컨테이너 `justify-center`
- 배경: `hsl(var(--primary))` 톤의 진한 배경 — 구체적으로 인라인 스타일을 `hsl(var(--primary) / 0.12)` 로 깔고, 좌우/하단 보더는 `border-primary/30`
- 글자: `text-primary` 계열로 강조, `font-semibold`, `uppercase`, `tracking-wider`, `text-[11px]`
- 드래그 핸들/필터 아이콘은 표시하지 않음 (그룹 헤더는 정렬/필터/드래그 비대상)
- `z-index: 3` (스크롤 시 2단 위로 자연스럽게)

#### 2단(leaf 헤더) — 기존 컬럼 라벨
- 정렬: 현재의 `text-left` 유지 (필터/정렬 아이콘이 우측에 자연스럽게 정렬되도록)
- 배경: `hsl(var(--muted))` 유지하되 살짝 진하게 — `hsl(var(--muted))` + `border-b-2 border-border` 로 1단과 시각 분리
- 글자: `font-medium text-foreground` 그대로
- 좌우 보더 음영 약간 강화 (`border-border`)

#### Placeholder 셀 (단일 레벨 컬럼의 1단 자리)
- 동일한 1단 톤(`hsl(var(--primary) / 0.12)`)으로 채워 1단 색대가 끊기지 않게 함

### 디자인 토큰 / 접근성
- 모두 기존 시맨틱 토큰(`--primary`, `--muted`, `--foreground`, `--border`) 사용 — 다크 모드 자동 대응
- primary/12 배경 위 primary 글자는 라이트/다크 양쪽 모두 4.5:1 이상 대비 확보
- 색약 사용자를 위해 색상만이 아니라 굵기·자간 변화로도 1단/2단 구분

### 변경 파일
- `src/components/mdr/grid/MdrAdvancedGrid.tsx`
  - `SortableHeaderCell` 의 `style` / className 분기
  - placeholder `<th>` 의 background/border 동기화

### 검증
- SD/DD/CD/Overall 1단 라벨이 정확히 그룹 가운데 정렬
- 1단 row 와 2단 row 가 한눈에 구분 (배경/굵기/자간)
- 가로 스크롤·세로 스크롤 시 색대 일관성 유지
- 정렬·필터·드래그 동작 정상 (leaf 한정)
- 다크 모드에서도 대비 충분
