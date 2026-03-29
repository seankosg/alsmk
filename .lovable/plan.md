

# Workspace 헤더 고정 + Task 테이블만 스크롤

## 현재 구조

Workspace 페이지가 `space-y-6` div 안에 헤더, 탭, TaskTable을 모두 포함하고 있어서 페이지 전체가 스크롤됩니다.

## 변경 방법

Workspace의 최상위 레이아웃을 `flex flex-col h-full overflow-hidden`으로 변경하여:
- 헤더 (제목 + 버튼들) → 고정
- 탭 (있는 경우) → 고정  
- TaskTable → 남은 영역에서 자체 스크롤

TaskTable 내부의 `<CardContent>` 안 테이블 영역에 `overflow-y-auto`와 `flex-1 min-h-0`을 적용하여 테이블 행만 세로 스크롤되도록 합니다. TaskTable의 CardHeader(필터/검색)도 고정됩니다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/pages/Workspace.tsx` | 최상위 div를 `flex flex-col h-full overflow-hidden`으로 변경, TaskTable 영역에 `flex-1 min-h-0` 적용 |
| `src/components/tasks/TaskTable.tsx` | Card를 `flex flex-col h-full`로, CardContent 내 테이블을 `overflow-y-auto flex-1 min-h-0`으로 변경. TableHeader에 `sticky top-0 z-10 bg-card` 적용 |

