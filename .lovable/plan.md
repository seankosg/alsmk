

## 신규 메시지 수신 알림 — 제안 옵션

현재 상태: `NotificationBell`이 이슈 플래그 알림만 처리하며, DM 수신 시 별도 알림 없음.

### 제안 A: 로그인 시 안읽은 메시지 요약 다이얼로그

로그인 직후 안읽은 DM이 있으면 화면 중앙에 간단한 다이얼로그를 표시:

```text
┌─ 📬 새 메시지 ──────────────────┐
│                                 │
│  안읽은 메시지 3건이 있습니다.    │
│                                 │
│  • 홍길동: "일정 확인 부탁..."    │
│  • 김철수: "자재 검토 완료..."    │
│                                 │
│  [메시지 보기]     [닫기]        │
└─────────────────────────────────┘
```

- `AppLayout` 마운트 시 `direct_messages`에서 `is_read = false` 건수 조회
- 있으면 다이얼로그 1회 표시, "메시지 보기" 클릭 시 `/messages`로 이동
- 세션당 1회만 표시 (sessionStorage 플래그)

### 제안 B: 사이드바 Messages 메뉴에 안읽은 수 배지

사이드바의 "Messages" 항목 옆에 빨간 배지로 안읽은 메시지 수 표시:

```text
📨 Messages  [3]
```

- `AppSidebar`에서 안읽은 DM 수를 실시간 구독
- Realtime `postgres_changes`로 새 메시지 INSERT 시 즉시 갱신

### 제안 C: 실시간 토스트 알림 (현재 페이지 무관)

새 DM이 도착하면 화면 하단에 토스트 알림 표시:

```text
┌─────────────────────────────┐
│ 💬 홍길동: "일정 확인..."    │
│              [메시지 보기]   │
└─────────────────────────────┘
```

- `AppLayout`에 전역 Realtime 구독 추가
- `direct_messages` INSERT 이벤트 감지 → `toast.info()` 표시
- 토스트 클릭 시 해당 대화로 이동

---

### 구현 제안

**A + B + C 모두 조합 적용**을 권장합니다:

| 상황 | 알림 방식 |
|------|-----------|
| 로그인 직후 | A: 안읽은 메시지 요약 다이얼로그 (1회) |
| 앱 사용 중 항상 | B: 사이드바 배지 (실시간 갱신) |
| 새 메시지 도착 시 | C: 토스트 알림 (즉시) |

### 파일 변경

- **신규**: `src/components/layout/UnreadMessagesDialog.tsx` — 로그인 시 안읽은 메시지 다이얼로그
- **신규**: `src/hooks/useUnreadMessages.ts` — 안읽은 DM 수 조회 + Realtime 구독 훅
- **수정**: `src/components/layout/AppLayout.tsx` — UnreadMessagesDialog 렌더 + 전역 DM 토스트 구독
- **수정**: `src/components/layout/AppSidebar.tsx` — Messages 메뉴에 안읽은 수 배지 추가

