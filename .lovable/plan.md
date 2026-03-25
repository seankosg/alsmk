

# CPM 페이지 리셋 문제 분석 및 개선 제안

## 원인

React Router의 `<Routes>` 안에서 경로가 바뀌면 이전 경로의 컴포넌트가 **unmount**되고 새 경로의 컴포넌트가 **mount**됩니다. `/cpm` → 다른 메뉴 → `/cpm` 으로 돌아오면 `CpmScheduler`가 완전히 재생성되고, 내부 iframe(`cpm_network.html`)도 처음부터 다시 로드됩니다.

이는 React Router의 기본 동작이며, iframe이 포함된 페이지에서는 특히 치명적입니다 — XML 파싱, 네트워크 레이아웃, 노드 위치 등 모든 상태가 사라집니다.

## 개선 방안

### 방법: CSS display 토글로 CPM 컴포넌트 유지

CPM 컴포넌트를 항상 마운트된 상태로 유지하되, 현재 경로가 `/cpm`이 아닐 때는 `display: none`으로 숨깁니다.

**변경 파일:** `src/App.tsx`

```text
변경 전:
  <Routes>
    <Route path="/cpm" element={<CpmScheduler />} />
    ...
  </Routes>

변경 후:
  {/* CPM은 항상 마운트, 경로에 따라 display 토글 */}
  <div style={{ display: location.pathname === '/cpm' ? 'block' : 'none' }}
       className="h-full">
    <CpmScheduler />
  </div>
  <Routes>
    {/* /cpm 경로는 빈 컴포넌트 렌더링 */}
    <Route path="/cpm" element={null} />
    ...기존 라우트...
  </Routes>
```

**추가 변경:** `src/components/layout/AppLayout.tsx`
- `useLocation()`으로 현재 경로를 가져와서 children 영역에 CPM 토글 로직 적용

### 효과
- 다른 메뉴로 이동해도 iframe이 unmount되지 않음
- XML, 네트워크 레이아웃, 노드 위치 등 모든 CPM 상태가 보존됨
- DB에서 스냅샷을 다시 로드할 필요 없음

### 주의사항
- CPM iframe은 메모리를 계속 점유하므로, 최초 로드 시점을 사용자가 `/cpm`을 처음 방문할 때로 지연(lazy mount) 처리
- `hasVisitedCpm` 상태 변수로 한 번이라도 방문한 적 있을 때만 마운트

