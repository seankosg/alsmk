

## 메시지 삭제 기능 추가

### 범위
1. **대화방 삭제** — ConversationList에서 각 대화 항목에 삭제 버튼
2. **개별 메시지 삭제** — ChatArea에서 내가 보낸 메시지에 삭제 옵션

### Step 1: DB Migration — DELETE RLS 정책 추가

3개 테이블에 DELETE 정책 추가 (기존 `is_conversation_member` 함수 활용):

```sql
-- 대화 멤버가 자신의 메시지 삭제 가능 (본인 메시지만)
CREATE POLICY "Members can delete own messages"
ON public.direct_messages FOR DELETE TO authenticated
USING (
  is_conversation_member(conversation_id, auth.uid())
  AND sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 대화 멤버가 대화방 삭제 가능
CREATE POLICY "Members can delete conversations"
ON public.conversations FOR DELETE TO authenticated
USING (is_conversation_member(id, auth.uid()));

-- 대화 멤버가 conversation_members 삭제 가능
CREATE POLICY "Members can delete conversation members"
ON public.conversation_members FOR DELETE TO authenticated
USING (is_conversation_member(conversation_id, auth.uid()));
```

### Step 2: ConversationList.tsx — 대화방 삭제

- 각 대화 항목 호버 시 `Trash2` 아이콘 버튼 표시
- 클릭 시 `AlertDialog`로 확인 ("이 대화를 삭제하시겠습니까?")
- 확인 시: `direct_messages` → `conversation_members` → `conversations` 순서로 삭제
- 삭제 후 conversations 쿼리 무효화
- 새 prop `onDelete(id)` 추가하여 Messages.tsx에서 선택 대화 초기화

### Step 3: ChatArea.tsx — 개별 메시지 삭제

- 내가 보낸 메시지(`isMe`)에 호버 시 `Trash2` 아이콘 표시
- 클릭 시 해당 메시지 DELETE 후 쿼리 무효화
- Realtime 채널에 DELETE 이벤트도 구독하여 실시간 반영

### Step 4: Messages.tsx — onDelete 콜백 연결

- ConversationList에 `onDelete` prop 전달
- 삭제된 대화가 현재 선택된 대화면 `selectedConversation`을 null로 초기화

### 파일 변경

| 파일 | 변경 |
|------|------|
| Migration SQL | DELETE RLS 정책 3개 |
| `ConversationList.tsx` | 삭제 버튼, AlertDialog, 삭제 로직 |
| `ChatArea.tsx` | 개별 메시지 삭제 버튼 + 로직 |
| `Messages.tsx` | onDelete 콜백 전달 |

