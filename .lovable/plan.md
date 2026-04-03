
# highlight 이동 실패 수정 계획 (필터 원인 제외)

## 수정 진단
현재 증상은 필터 문제가 아니라, 아래 2개가 겹친 가능성이 큽니다.

1. `src/pages/CpmScheduler.tsx`
- `highlightParam`를 읽자마자 바로 URL에서 삭제합니다.
- 그 직후 effect가 다시 실행되면서 cleanup이 먼저 돌고, 예약해둔 `focus-node` retry timer들이 취소됩니다.
- 그래서 `ActivityTaskPanel`용 DB 조회는 살아남아 패널은 열리지만, 실제 iframe 포커스 메시지는 거의 보내지지 않거나 매우 불안정해집니다.

2. `public/cpm_network.html`
- `focus-node` 핸들러가 실제 스크롤 컨테이너인 `#networkCanvas`가 아니라 `#svgContainer`에 `scrollTo()`를 호출하고 있습니다.
- `#svgContainer`는 스크롤 주체가 아니어서, 메시지가 도착해도 화면 이동이 일어나지 않습니다.

즉, “패널은 열리는데 노드는 안 보이는” 현재 증상과 정확히 맞습니다.

## 구현 변경

### 1) `src/pages/CpmScheduler.tsx`
`highlight` 처리 로직을 “URL 수신”과 “실제 포커싱 실행”으로 분리합니다.

- `highlightParam`를 별도 `pendingHighlight` state로 복사
- URL의 `highlight`는 즉시 지워도 되지만, 포커싱 effect는 `pendingHighlight` 기준으로 실행
- `focus-node`는 즉시 1회 + 기존 retry 방식 유지
- `ActivityTaskPanel` 자동 오픈도 같은 `pendingHighlight` 기준으로 유지
- `setSearchParams`는 기존처럼 mutate-return 대신 새 `URLSearchParams`를 만들어 안전하게 처리

핵심:
```text
URL highlight 수신 → pendingHighlight 저장 → URL 정리
pendingHighlight effect → focus-node 전송 + retry + 패널 자동 오픈
```

이렇게 하면 같은 노드를 다시 클릭하는 UX도 유지하면서 timer cleanup 문제를 제거할 수 있습니다.

### 2) `public/cpm_network.html`
`focus-node` 핸들러를 중복 구현하지 말고, 기존 검증된 네비게이션 유틸을 재사용하도록 정리합니다.

- 전달받은 `nodeId`를 `internal id / mppTaskId / _uid` 기준으로 먼저 해석
- 최종 internal activity id를 찾으면:
  - `switchTab('network')`
  - `scrollToNode(internalId)` 호출
  - `highlightSidebarCard(internalId)` 호출
- 기존의 수동 `svgContainer.scrollTo(...)` + 수동 pulse rect 생성 코드는 제거하거나 `scrollToNode()` 기반으로 통일

이 방식이 좋은 이유:
- 이미 sidebar 클릭 / alert dropdown 이동에서 같은 패턴이 동작 중
- 스크롤 대상이 자동으로 `networkCanvas`로 일관화됨
- 포커스 로직이 한 군데(`scrollToNode`)로 모여서 재발 확률이 낮아짐

## 변경 파일
| 파일 | 변경 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | `highlight` 처리 2단계화 (`pendingHighlight`) 및 timer cleanup 문제 제거 |
| `public/cpm_network.html` | `focus-node`를 `networkCanvas` 기반 이동으로 수정, 기존 `scrollToNode()` 재사용 |

## 기술 메모
- DB/권한/RLS 변경 없음
- 이번 수정은 프론트엔드 라우팅 + iframe 포커싱 로직만 수정
- 가장 가능성 높은 실제 원인은:
  1. 부모 effect의 조기 cleanup
  2. iframe의 잘못된 scroll target
- 따라서 이전의 “필터 해제” 접근보다 훨씬 직접적인 수정입니다.
