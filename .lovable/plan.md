

# Team Progress 차트에 개인별 Progress 토글 추가

## 개요
TeamProgressChart 카드 헤더에 "Team / Individual" 토글 버튼을 추가하여, 팀별 진행률 차트와 개인별(멤버별) 진행률 차트를 전환할 수 있게 합니다.

## 변경: `src/components/dashboard/TeamProgressChart.tsx`

### 1. 토글 상태 추가
- `viewMode` state: `"team"` | `"individual"` (기본값 `"team"`)
- CardHeader에 ToggleGroup 버튼 배치 (Users/Building2 아이콘)

### 2. Individual 모드 차트 데이터
- `members` 데이터에서 각 멤버별로 할당된 태스크(`assignee_id`)를 집계
- 팀 차트와 동일한 방식으로 `weightedAvg`로 Planned/Actual/Gap 계산
- 태스크가 없는 멤버는 제외
- X축: 멤버 이름 (긴 이름은 truncate)

### 3. 클릭 드릴다운
- Individual 모드에서 바 클릭 시 해당 멤버의 태스크 목록 다이얼로그 표시
- 기존 팀 드릴다운 다이얼로그와 동일한 UI 패턴 재사용

### 4. UI 구조
```text
CardHeader:
  [Team Progress]          [Team | Individual] ← ToggleGroup
  subtitle text

CardContent:
  team 모드 → 기존 팀별 BarChart
  individual 모드 → 멤버별 BarChart (동일 스타일)
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/TeamProgressChart.tsx` | viewMode 토글, individual chartData 계산, 멤버 드릴다운 다이얼로그 |

