

## Milestone Timeline — 오늘 위치에 경과일수 표시

### 변경 내용
**파일**: `src/components/dashboard/MilestoneTimeline.tsx`

현재 타임라인의 "Today marker" 위치(진행선 끝)에 경과 일수를 라벨로 표시합니다.

- **계산**: `differenceInDays(today, firstMilestone.target_date)` — 첫 마일스톤 기준 경과일
- **표시**: 진행선 끝(오늘 위치) 바로 위에 작은 pill 라벨로 `Day 45` 또는 `+45일` 형태
- **위치**: `elapsedPercent` 값을 이용하여 기존 Today marker와 동일한 left 위치에 배치
- 현재 비어있는 Today marker div 내부에 라벨 요소 추가

```text
Timeline 가로선:
━━━━━━━━━━━━━━●━━━━━━━━━━━━━
              [+45d]
              ↑ 오늘 위치
```

### 수정 범위
- `MilestoneTimeline.tsx` 95~101번 줄 Today marker 영역에 경과일 라벨 추가 (약 10줄)

