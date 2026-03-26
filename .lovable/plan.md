

# 메시지 새 대화 생성 실패 수정

## 원인 분석

`NewConversationDialog.handleCreate` 코드를 추적한 결과, 두 가지 잠재적 문제를 발견:

1. **`memberId`가 null이면 무응답 반환** (line 66): `if (!memberId) return;` — 에러 메시지 없이 조용히 종료됨. `useAuth`에서 `memberId`는 `setTimeout` 비동기 콜백으로 설정되므로 타이밍 이슈가 가능합니다.

2. **에러 토스트가 Dialog 뒤에 숨겨짐**: DB 에러가 발생해도 Sonner 토스트가 Dialog의 z-index 아래에 렌더링되어 사용자에게 보이지 않을 수 있습니다.

## 수정 사항

### 1. `src/components/messages/NewConversationDialog.tsx`

**memberId null 방어 + 사용자 피드백**:
```typescript
const handleCreate = async () => {
  if (selectedIds.length === 0) return;
  if (!memberId) {
    toast.error("사용자 정보를 불러오지 못했습니다. 페이지를 새로고침해주세요.");
    return;
  }
  // ...rest
```

**catch 블록에 console.error 추가**:
```typescript
} catch (err: any) {
  console.error("Conversation creation failed:", err);
  toast.error(err.message || "대화 생성에 실패했습니다.");
}
```

### 2. `src/components/ui/sonner.tsx` — 토스트 z-index 수정

Sonner의 `toastOptions`에 z-index를 Dialog(z-50) 위인 `z-[100]`으로 설정하여 Dialog 위에 표시되도록 합니다.

### 3. `src/components/messages/NewConversationDialog.tsx` — DialogContent에 aria-describedby 추가

Console warning 해소:
```tsx
<DialogContent className="sm:max-w-[420px]" aria-describedby={undefined}>
```

## 변경 파일 요약
| 파일 | 변경 |
|------|------|
| `NewConversationDialog.tsx` | memberId null 시 토스트 표시, catch에 console.error, aria-describedby 경고 해소 |
| `sonner.tsx` | 토스트 z-index를 z-[100]으로 올림 |

