

# CPM 수동 리로드 버튼 추가

## 현재 상황
- 데이터가 사라졌을 때 복구하려면 브라우저 전체를 새로고침해야 하며, 이마저도 race condition으로 실패할 수 있음
- 수동으로 hydration을 재요청하는 UI가 없음

## 구현

### `src/pages/CpmScheduler.tsx`
- 플로팅 툴바에 **🔄 새로고침** 버튼 추가 (Admin/PM 전용 영역 옆)
- 클릭 시 `hydrateIframe(iframeRef.current?.contentWindow)` 직접 호출
- 비Admin 사용자용으로도 별도 위치에 작은 새로고침 버튼 배치

### 동작
1. 버튼 클릭 → `hydrateIframe()` 호출 → DB에서 최신 스냅샷 + 상태 데이터를 iframe에 전송
2. iframe이 `cpm-hydrate` 메시지를 수신하면 네트워크 복원
3. toast로 "CPM 데이터 새로고침 완료" 표시

이 방법은 승인된 핸드쉐이크 자동 재전송 계획과 별도로, 사용자가 직접 복구할 수 있는 즉각적인 해결책입니다.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/pages/CpmScheduler.tsx` | 새로고침 버튼 추가, `hydrateIframe` 직접 호출 |

