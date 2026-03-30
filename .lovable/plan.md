

# Team Progress 차트 — 계산 로직 불일치 수정

## 발견된 문제 2가지

### 문제 1: Summary Task 포함 (주요 원인)
차트의 평균 계산에 `is_summary = true`인 부모 태스크가 포함됨. Summary 태스크는 하위 태스크의 평균으로 자동 계산되므로, 함께 평균내면 **이중 계산**이 됨. DES 팀에 summary 태스크가 있다면 실적 수치가 왜곡됨.

### 문제 2: 드릴다운이 "Behind Schedule"만 표시
차트의 Actual은 **전체 팀 태스크**의 평균이지만, 클릭 시 드릴다운은 `gap < 0`인 **지연 태스크만** 표시함. 사용자가 차트 수치와 드릴다운 리스트를 비교하면 당연히 불일치.

## 수정 방안

### 변경 파일: `src/components/dashboard/TeamProgressChart.tsx`

1. **Summary 태스크 제외**: `tasks.filter`에 `!t.is_summary` 조건 추가하여 차트 계산 및 드릴다운 모두에서 summary 태스크 제외

2. **드릴다운을 전체 태스크 리스트로 변경**: 
   - 다이얼로그 제목: "Behind Schedule" → 팀 전체 태스크 목록
   - 모든 팀 태스크를 gap 오름차순으로 표시 (지연 태스크가 상단)
   - gap >= 0인 태스크는 초록색으로, gap < 0인 태스크는 빨간색으로 표시
   - 상단에 팀 평균 요약 (Plan / Actual / Gap) 표시

### 구체적 변경

```
Line 72: teamTasks 필터에 is_summary 제외 추가
  const teamTasks = tasks.filter((t) => t.team_id === team.id && !t.is_summary);

Line 129-138: behindTasks → allTeamTasks로 변경, filter(gap < 0) 제거
  const allTeamTasks = selectedTeam
    ? tasks
        .filter(t => t.team_id === selectedTeam.id && !t.is_summary)
        .map(t => { ... })
        .sort((a, b) => a.gap - b.gap)
    : [];

Line 203-206: 다이얼로그 헤더 변경
  - 제목: "{팀명} — Task Progress"
  - 서브텍스트: "{N}개 태스크 | 평균 Plan {X}% / Actual {Y}%"

Line 229: gap 색상 조건부 적용
  gap >= 0 → text-success, gap < 0 → text-destructive
```

