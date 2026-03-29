

# Workspace 스크롤 문제 수정

## 원인

`AppLayout.tsx`의 `main` 태그에 `overflow-auto`가 설정되어 있어, **main 자체가 스크롤 컨테이너**입니다. Workspace의 `h-full overflow-hidden`이 작동하려면 부모 높이가 고정되어야 하는데, `overflow-auto`인 main 안의 `div.h-full`이 실제 콘텐츠 높이로 확장되어 Workspace의 높이 제약이 깨집니다.

## 수정 방법

`AppLayout.tsx` line 108의 children wrapper를 CpmScheduler와 동일하게 `absolute inset-0`으로 변경하되, main의 padding 영역 안에 위치하도록 별도 relative wrapper를 추가합니다.

| 파일 | 변경 |
|------|------|
| `src/components/layout/AppLayout.tsx` | main 내부 구조를 변경: children wrapper에 높이 제약이 올바르게 전파되도록 수정 |

### 구체적 변경

```tsx
// Before (line 102-111)
<main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 relative">
  {/* CpmScheduler absolute div */}
  <div style={{ display: isCpmRoute ? 'none' : 'block' }} className="h-full">
    {children}
  </div>
</main>

// After
<main className="flex-1 overflow-hidden p-3 sm:p-4 md:p-6 relative">
  {/* CpmScheduler absolute div - unchanged */}
  <div style={{ display: isCpmRoute ? 'none' : 'flex' }} 
       className="flex-col h-full overflow-auto">
    {children}
  </div>
</main>
```

- `main`: `overflow-auto` → `overflow-hidden` (main이 스크롤하지 않도록)
- children wrapper: `display: block` → `display: flex`, `flex-col h-full overflow-auto` 추가
  - Workspace처럼 `overflow-hidden`인 페이지는 자체 높이 내에서 내부 스크롤
  - Dashboard 등 긴 페이지는 이 wrapper가 스크롤 컨테이너 역할

이렇게 하면 Workspace의 `h-full overflow-hidden` → TaskTable의 `flex-1 min-h-0 overflow-auto` 체인이 정상 작동합니다.

