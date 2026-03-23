

# CPM 노드 리스크 시각화 — 수정된 계획

## 사용자 피드백 반영
프로그래스 바는 **한 줄**로 표시. 두 줄이 아닌, 하나의 바 안에 계획/실제/갭을 레이어링.

## 변경 사항

### 1. `src/pages/CpmScheduler.tsx`
- `upsertActivities` 완료 후 activity별 매핑 태스크 상태 집계 함수 추가
- `cpm_task_mappings` + `tasks` 조인 → activity name 기준으로 그룹핑
- 각 태스크의 planned progress(`calcPlannedProgress`) vs `current_progress` 비교
  - 차이 > 5%: delayed, 그 외: onTrack
- 집계 결과를 `iframe.postMessage({ type: 'activity-status-update', statuses })` 전송
  - `statuses`: `[{ activityName, totalTasks, onTrack, delayed, actualPct, plannedPct }]`

### 2. `public/cpm_network.html`

**NODE_H 확장**: 92 → 104 (상단 태스크 현황 행 + 여유)

**메시지 수신기 추가**:
- `activity-status-update` → `window._activityStatusMap` (name 기반) 저장
- 수신 후 `drawNetwork` 재호출

**노드 SVG 수정 (drawNetwork 내)**:

**(a) 노드 최상단 — 태스크 현황 아이콘 (상단 컬러 바 바로 아래, 기존 콘텐츠 위)**
- statusMap에서 해당 activity의 데이터 조회
- 매핑이 있을 때만 표시:
  - `⬤ {total}` (흰색) — 총 태스크 수
  - `⬤ {onTrack}` (초록 `#3dd68c`) — 정상 진행
  - `⬤ {delayed}` (빨강 `#ff4d4d`) — 지연
- 기존 ID/WBS/이름 등 텍스트 y좌표를 약 12px 아래로 이동

**(b) Progress Bar — 한 줄 3-레이어 바**
기존 단일 바를 교체. 하나의 바 안에서:

```text
|████████████░░░░░░░░░░░| 
 ↑ 파랑(실제)  ↑ 빨강(갭)  ↑ 회색(남은 계획)
```

- 전체 배경: 투명 (`rgba(255,255,255,.06)`)
- 계획 진행률 영역: 회색 (`#555`) — 0부터 plannedPct까지
- 실제 진행률: 파란색 (`#4da6ff`) — 0부터 actualPct까지 (계획 위에 덮어씀)
- **실제 < 계획일 때**: actualPct~plannedPct 구간을 빨간색 (`#ff4d4d`)으로 표시
- 매핑 없는 activity는 기존 단일 바 유지 (MPP progress 사용)
- 바 오른쪽에 `실제%/계획%` 텍스트

### 변경 파일
| 파일 | 변경 |
|------|------|
| `src/pages/CpmScheduler.tsx` | 태스크 상태 집계 + postMessage 전송 |
| `public/cpm_network.html` | 메시지 수신 + 노드 SVG 오버레이 렌더링 |
| `.lovable/memory/features/cpm-integration.md` | Phase 3 시각화 기록 |

