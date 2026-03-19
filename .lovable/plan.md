

# Summary Task 종합 기능 — 배경색 강화 + 그룹 정렬 유지 + 접기/펼치기

## 변경 파일: `src/components/tasks/TaskTable.tsx` (단일 파일)

## 1. Summary 행 배경색 강화

현재 `bg-muted/30`으로 구분이 약함.

변경:
- Summary 행: `bg-primary/10 border-l-2 border-l-primary`
- 좌측 강조선 + 진한 배경으로 시각적 구분 극대화

## 2. 그룹 정렬 유지

현재 정렬 시 Summary와 Subtask가 분리되는 문제 해결.

**로직**:
1. `filtered` 배열을 3그룹으로 분리: summaries, subtasks (parent_id별 Map), independents
2. summaries + independents를 현재 sortKey/sortDir로 정렬
3. 정렬된 목록을 순회하며 summary 뒤에 해당 subtask 삽입 (subtask끼리도 같은 기준 정렬)

```text
정렬 결과 예시 (Finish ASC):
  [Summary A]          ← bg-primary/10, border-l-primary
    └ Subtask A-01     ← pl-6 들여쓰기
    └ Subtask A-02
  [독립 Task X]
  [Summary B]
    └ Subtask B-01
```

## 3. 접기/펼치기 (+/−) 기능

- `collapsedSummaries` state (`Set<string>`) 추가
- Summary 행의 Subject 셀 앞에 `ChevronRight` (접힘) / `ChevronDown` (펼침) 아이콘 추가
- 접힌 Summary의 subtask는 렌더링에서 제외
- 독립 task에는 아이콘 없음
- 이벤트 전파 차단으로 행 클릭(상세보기)과 분리

## 4. 구현 순서

| 단계 | 내용 |
|------|------|
| 1 | `collapsedSummaries` state 추가, `ChevronRight`/`ChevronDown` import |
| 2 | 정렬 로직을 그룹 기반으로 재구성 (sort → 그룹 재배치) |
| 3 | 렌더링 시 접힌 subtask 필터링 + Summary 행에 토글 아이콘 |
| 4 | Summary 행 배경색을 `bg-primary/10 border-l-2 border-l-primary`로 변경 |

