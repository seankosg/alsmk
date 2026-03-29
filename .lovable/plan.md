

# Activity Finish Date 초과 Task 알람 구현 계획

## 개념

각 CPM Activity 노드의 `finish_date`보다 매핑된 Task 중 가장 늦은 `end_date`가 더 늦은 경우, 해당 Activity가 **일정 초과 위험** 상태임을 알려주는 경고를 표시합니다.

## 표시 위치 (3곳)

### 1. 네트워크 다이어그램 노드 (`public/cpm_network.html`)
- `ActivityStatus`에 `overdue` boolean + `overdueDays` 숫자를 추가하여 iframe에 전달
- 노드 렌더링 시 `overdue === true`이면 노드 우측 하단에 `⚠ +N일` 텍스트를 빨간색으로 표시
- 툴팁(showNodeTooltip)에도 "Task 초과: +N일" 행 추가

### 2. 상세패널 헤더 (`ActivityTaskPanel.tsx`)
- 매핑된 Task의 `max(end_date)`를 계산하여 Activity `finishDate`와 비교
- 초과 시 날짜 표시 영역 아래에 경고 배너: `⚠ Task 종료일이 Activity 종료일보다 N일 초과` (destructive 스타일)

### 3. Workspace Task 테이블 (선택적 — 추후)
- CPM 매핑 아이콘 옆에 해당 Task가 속한 Activity의 종료일을 초과하는 경우 추가 표시

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/hooks/useCpmViewModel.ts` | `ActivityStatus`에 `overdue`, `overdueDays`, `maxTaskEndDate` 필드 추가. Activity `finish_date` select에 포함. 매핑된 Task `end_date` 최대값과 비교하여 계산 |
| `public/cpm_network.html` | status 데이터에서 `overdue`/`overdueDays` 읽어 노드에 `⚠ +N일` 표시 + 툴팁에 행 추가 |
| `src/components/cpm/ActivityTaskPanel.tsx` | `mappedTasks`의 `max(end_date)` vs `activity.finishDate` 비교 → 경고 배너 렌더링 |

## 로직 상세

### useCpmViewModel.ts — 상태 계산

```typescript
// ActivityStatus 인터페이스 확장
overdue: boolean;     // max(task.end_date) > activity.finish_date
overdueDays: number;  // 초과 일수 (0이면 정상)

// buildStatusAndCustomFields 내부
// activities select에 finish_date 추가
const maxTaskEnd = validTasks.reduce((max, t) => {
  const d = new Date(t.end_date);
  return d > max ? d : max;
}, new Date(0));

const actFinish = act.finish_date ? new Date(act.finish_date) : null;
const overdueDays = (actFinish && validTasks.length)
  ? Math.max(0, Math.round((maxTaskEnd.getTime() - actFinish.getTime()) / 86400000))
  : 0;
```

### cpm_network.html — 노드 표시

- `drawNode()` 함수에서 status의 `overdue`가 true일 때 노드 박스 하단에 빨간 텍스트 `⚠ +{days}d` 추가
- 노드 border를 `#ff4d4d` 점선으로 변경하여 시각적 강조

### ActivityTaskPanel.tsx — 상세패널 경고

- 날짜 표시 행 아래에 조건부 경고:
```tsx
{overdueDays > 0 && (
  <div className="bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 flex items-center gap-1.5 text-xs text-destructive">
    <AlertTriangle className="h-3 w-3" />
    Task 종료일이 Activity 종료일보다 {overdueDays}일 초과
  </div>
)}
```

## 요약

DB 스키마 변경 없이, 기존 `cpm_activities.finish_date`와 매핑된 `tasks.end_date`를 비교하는 순수 프론트엔드 로직입니다. 3개 파일 수정으로 네트워크 노드 + 툴팁 + 상세패널에 일관된 초과 경고를 표시합니다.

