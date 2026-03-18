

## 팀 프로그래스 막대 위 수치 표시 (워딩 없이 숫자만)

### 변경 파일
**`src/components/dashboard/TeamProgressChart.tsx`**

### 변경 내용
각 팀의 두 막대(계획/실제) 위에 퍼센트 숫자만 표시하고, 그 위에 Gap 숫자를 표시합니다. "Plan", "Actual" 등 텍스트 라벨 없이 순수 숫자만 사용합니다.

- 차트 높이 `220px` → `280px`로 증가 (라벨 공간 확보)
- Planned 막대: 커스텀 `label`로 상단에 `52%` 형태 표시
- Actual 막대: 커스텀 `label`로 상단에 `48%` 표시, 그 윗행에 Gap 값 (`-4%p`) 색상 코딩 표시
  - 양수: 초록 (`hsl(var(--success))`)
  - 음수: 빨강 (`hsl(var(--destructive))`)

```text
       -4%p          +5%p
  52%    48%     35%    40%
  ████   ████    ████   ████
   DES              PRO
```

- 범례(legend)의 "Planned" / "Actual" 라벨은 차트 하단 범례에서만 유지 (chartConfig)
- 막대 위에는 워딩 없이 숫자만 렌더링

DB 변경 없음. 단일 파일 수정.

