## 문제

`MdrAdvancedGrid` 의 표가 헤더 폭과 본문 셀 폭이 서로 어긋남.

원인:
1. `<table style={{ width: totalWidth, minWidth: "100%" }}>` — `table-layout`이 auto 라 브라우저가 헤더 셀 폭을 콘텐츠에 맞춰 재분배.
2. 본문 `<tr>`은 `display:flex` + `<td style={{ width: getSize() }}>` 로 정확한 폭 강제. → 헤더(테이블 레이아웃)와 본문(flex) 두 레이아웃 시스템이 충돌해 어긋남.
3. `minWidth: "100%"` 때문에 totalWidth < 컨테이너일 때 표가 늘어나면서 헤더만 더 벌어짐.

## 참고

SHAW PROJECT CMS `DefectRawDataPage.tsx` (1715–1798) 패턴을 그대로 적용:
- 헤더/본문을 **하나의 `<table style={{ tableLayout: 'fixed', width: totalWidth }}>`** 안에 둠
- 가로/세로 스크롤은 **하나의 컨테이너** (`overflow:auto`)가 모두 소유
- 헤더 `<th>`는 `position: sticky; top: 0` 로 세로 스크롤 시 고정
- 가상화는 `display:flex` 가 아니라 **상/하단 padding `<tr>` spacer + 일반 `<tr>`** 로 처리 → 테이블 레이아웃을 깨지 않음

## 변경 파일

**`src/components/mdr/grid/MdrAdvancedGrid.tsx`** 한 파일만.

### 1. 본문 가상화 방식 교체

기존:
```tsx
<tbody style={{ height: totalSize, position: relative, display: block }}>
  {virtualItems.map(v => (
    <tr className="absolute flex" style={{ transform: translateY(...) }}>
      {cells.map(c => <td style={{ width: getSize() }}>...)}
    </tr>
  ))}
</tbody>
```

신규(SHAW 패턴):
```tsx
<tbody>
  {paddingTop > 0 && (
    <tr aria-hidden style={{ height: paddingTop }}>
      <td colSpan={visibleLeafColumns.length} style={{ padding:0, border:0 }} />
    </tr>
  )}
  {virtualItems.map(v => {
    const row = tableRows[v.index];
    return (
      <tr key={row.id} style={{ height: 32 }} className="border-t hover:bg-muted/30 ...">
        {row.getVisibleCells().map(cell => (
          <td
            key={cell.id}
            style={{
              width: cell.column.getSize(),
              minWidth: cell.column.getSize(),
              maxWidth: cell.column.getSize(),
              overflow: 'hidden',
            }}
            className="border-r px-2 py-1 truncate whitespace-nowrap"
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  })}
  {paddingBottom > 0 && (
    <tr aria-hidden style={{ height: paddingBottom }}>
      <td colSpan={visibleLeafColumns.length} style={{ padding:0, border:0 }} />
    </tr>
  )}
</tbody>
```

`paddingTop = virtualItems[0]?.start ?? 0`, `paddingBottom = totalSize - (virtualItems.at(-1)?.end ?? 0)` 로 계산.

### 2. 테이블 레이아웃 고정

- `<table>` 에 `style={{ width: totalWidth, tableLayout: 'fixed' }}` — `minWidth:"100%"` 제거 (totalWidth가 곧 본문 폭이며, 컨테이너가 작으면 가로 스크롤이 생김).
- 각 `<th>` 도 `style={{ width, minWidth: width, maxWidth: width }}` 로 3종 모두 지정.

### 3. 헤더 sticky 유지

기존 `<thead className="sticky top-0 z-10 bg-muted">` 는 그대로 두되, SHAW와 동일하게 `<th>` 자체에 `position: sticky; top: 0; z-index: 2; background: hsl(var(--muted))` 를 적용해도 됨. 둘 중 안정적인 `<th>` 단위 sticky 사용.

### 4. 스크롤 컨테이너

`<div ref={tableRef} className="relative max-h-[70vh] overflow-auto">` 그대로 — 이미 SHAW와 동일하게 하나의 컨테이너가 가로/세로 스크롤을 소유. `TopHorizontalScrollbar` 는 기존대로 위쪽에 미러링.

## 범위 외

- `columns.tsx`, `TopHorizontalScrollbar.tsx`, 다른 파일 변경 없음
- 정렬/필터/리사이즈/영속화 로직 변경 없음 (지난 턴 결과 유지)
- frozen 컬럼(좌측 sticky) 도입은 별도 요청 시 진행
