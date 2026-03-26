

# 네트워크 다이어그램 4가지 개선사항 구현 계획

## 1. 필터 개별 해제 기능

**현재**: `clearAllFilters()` 하나로 WBS/BLDG 모두 해제. 개별 해제 불가.

**변경**: `public/cpm_network.html`

- **filterLabel 영역** (line 520): 단일 `✕` 대신, 각 활성 필터를 개별 칩(chip)으로 표시하고 각각 `✕` 버튼 부여
- **drawNetwork 내 filterLabel 업데이트** (line 986-995): `filterText`를 WBS 칩들 + BLDG 칩들로 분리 렌더링. 각 칩에 개별 해제 onclick 연결
- **새 함수 추가**: `removeWbsFilterItem(wbsCode)` — 해당 WBS 하나만 Set에서 제거 후 redraw. `removeBldgFilterItem(bldgValue)` — 동일 패턴
- **전체 해제 버튼**은 유지 (맨 끝에 "전체 해제" 텍스트)

```text
필터 영역 예시:
[WBS 1.1 ✕] [WBS 2.3 ✕] [BLDG A동 ✕]  [전체 해제 ✕]
```

## 2. 노드 툴팁에 상태아이콘/진도율/BLDG 정보 추가

**현재** `showNodeTooltip` (line 1615-1670): ID, WBS, 이름, 기간, TF, ES/EF/LS/LF, 선행 Activity만 표시. 상태아이콘(●총/●정상/●지연), 실적/계획 진도율, BLDG 값 누락.

**변경**: `public/cpm_network.html` `showNodeTooltip` 함수

- `window._activityStatusMap`에서 해당 activity의 status 데이터 조회
- 상태아이콘 행 추가: `●Total ●OnTrack ●Delayed` (노드에 표시되는 것과 동일)
- 실적/계획 진도율 바 추가: `실적: XX% / 계획: YY%`
- BLDG 값 표시: customFields에서 BLDG/Text2/텍스트2 추출하여 표시
- MPP 진행률도 표시 (activity.progress)

## 3. 헤더에 스냅샷/XML 버전 표시

**현재** header (line 444-445): `CPM / NETWORK SCHEDULER` 텍스트만 표시.

**변경**: `public/cpm_network.html`

- 로고 옆에 `<span id="versionLabel">` 추가
- 스냅샷 복원 시 (line 2960-2970): `snapshot.name`, `snapshot.savedAt` 또는 `dbUpdatedAt`을 `versionLabel`에 표시
- XML 업로드 시: 파일명과 업로드 시간 표시
- `calculate()` 실행 시: 현재 소스(XML/수동/스냅샷) 정보 업데이트
- 전역 변수 `window._currentVersion = { source: 'snapshot'|'xml'|'manual', name: '...', time: '...' }` 관리

표시 형식: `v: default (2024-03-26 14:30)` 또는 `v: project.xml`

## 4. 우측 상세패널(ActivityTaskPanel) BLDG 배지 + 상태아이콘

**현재 상태**:
- BLDG 배지: 이미 line 210-213에 구현되어 있음 ✅ (이미 존재)
- 상태아이콘/갯수: 없음. GAP/Tasks/지연 메트릭만 있음 (line 314-332)
- 매핑 후 실시간 반영: `onStatusChanged` 콜백으로 iframe에는 반영되나 패널 자체 metrics는 `refetchMappings`로 갱신됨 ✅

**변경**: `src/components/cpm/ActivityTaskPanel.tsx`

- **Key metrics 영역 위**(line 314 직전)에 상태아이콘 행 추가:
  - `●Total {mappedTasks.length}  ●OnTrack {onTrackCount}  ●Delayed {delayedCount}` — 네트워크 노드와 동일한 아이콘 스타일
- onTrackCount 계산 추가: `mappedTasks.length - delayedCount`
- 실시간 반영: 이미 `refetchMappings()` + `onStatusChanged()`가 `MapTasksDialog.onMapped`에서 호출되므로 추가 작업 불필요

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `public/cpm_network.html` | 1) filterLabel → 개별 칩 + 개별해제 함수 2) showNodeTooltip에 상태/BLDG/진도율 추가 3) 헤더 버전 라벨 |
| `src/components/cpm/ActivityTaskPanel.tsx` | 상태아이콘(Total/OnTrack/Delayed) 행 추가 (매핑 버튼 위) |

