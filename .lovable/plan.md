
# Workspace 스크롤 문제 재분석 결과

## 현재 확인된 상태

이 문제는 `Workspace.tsx`나 `TaskTable.tsx`가 아니라, 상위 레이아웃인 `AppLayout.tsx`에서 다시 발생하고 있습니다.

### 이미 제대로 되어 있는 부분
- `src/pages/Workspace.tsx`
  - `flex flex-col h-full overflow-hidden`
  - `flex-1 min-h-0`
- `src/components/tasks/TaskTable.tsx`
  - `Card className="flex flex-col h-full"`
  - `CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col"`
  - 내부 테이블 영역 `overflow-auto flex-1 min-h-0`
  - 헤더 `sticky top-0`

즉, **Workspace 내부 구조는 이미 맞게 구현되어 있습니다.**

### 실제 원인
현재 `src/components/layout/AppLayout.tsx`가 아직 아래 상태입니다:

```tsx
<main className="flex-1 overflow-hidden p-3 sm:p-4 md:p-6 relative">
  ...
  <div className="flex-col h-full overflow-auto">
    {children}
  </div>
</main>
```

이 구조 때문에:
- `main`이 flex 컨테이너가 아님
- child wrapper가 `h-full`로 계산되면서 패딩 포함 높이를 기준으로 커짐
- wrapper 자체가 `overflow-auto` 스크롤 컨테이너가 됨
- 결과적으로 **Workspace 내부 task 영역이 아니라 페이지 전체가 스크롤**됨

## 왜 “전에 됐는데 지금 안 되나”

가능성이 가장 높은 원인은 둘 중 하나입니다.

1. **이전 수정 계획은 승인됐지만 실제 코드 반영이 누락됨**
   - 현재 코드상 `AppLayout.tsx`에는 그 수정이 들어가 있지 않습니다.

2. **한번 수정되었더라도 이후 다른 변경 과정에서 되돌아감**
   - 현재 남아 있는 코드가 정확히 “수정 전 구조”입니다.

즉, 이번 이슈는 새 버그라기보다 **상위 레이아웃 수정이 현재 코드 기준으로 적용되지 않은 상태**라고 보는 것이 맞습니다.

## 수정 계획

### 1) `AppLayout.tsx` 상위 레이아웃 체인 복구
다음 두 줄을 핵심으로 수정합니다.

- `main`
  - `flex flex-col` 추가
- children wrapper
  - `h-full` 제거
  - `flex-1 min-h-0`로 변경

목표 구조:
```tsx
<main className="flex-1 overflow-hidden p-3 sm:p-4 md:p-6 relative flex flex-col">
  ...
  <div className="flex-col flex-1 min-h-0 overflow-auto">
    {children}
  </div>
</main>
```

### 2) CPM 화면과 일반 화면 동작 유지
- `/cpm`은 기존처럼 absolute iframe 유지
- 일반 페이지는 wrapper가 스크롤 컨테이너
- `Workspace`는 내부에서만 스크롤
- `Dashboard`, `Calendar` 등은 기존처럼 페이지 단위 스크롤 유지

### 3) 스크롤 체인 점검
수정 후 아래 동작을 함께 확인합니다.
- Workspace: 상단 제목/버튼/필터/테이블 헤더 고정
- Workspace: task row만 세로 스크롤
- Dashboard: 전체 콘텐츠 자연 스크롤
- Calendar: 기존 스크롤 유지
- CPM: 레이아웃 깨짐 없음

## 변경 파일

- `src/components/layout/AppLayout.tsx`

## 기대 결과

수정 후에는:
- My Workspace에서 전체 화면이 아니라 **task 리스트만 스크롤**
- 상단 헤더와 기능 버튼은 고정
- 다른 페이지의 기존 스크롤 동작은 유지

## 핵심 결론

이번 문제의 원인은 이전에 의심했던 대로 **Workspace 내부가 아니라 AppLayout 상위 높이/overflow 체인**입니다. 현재 코드상 그 핵심 수정이 적용되어 있지 않아서, 내부 스크롤 구조가 살아나지 못하고 있습니다.
