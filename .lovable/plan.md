

## 댓글/코멘트/지시사항 수정 및 삭제 기능

### 1. DB 변경 (마이그레이션)

`task_comments` 테이블에 UPDATE, DELETE RLS 정책 추가:
- **작성자 본인**: 자신의 댓글 수정/삭제 가능
- **Admin**: 모든 댓글 수정/삭제 가능

```sql
CREATE POLICY "Author can update own comments" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (author_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (author_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Admin can update any comment" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- DELETE도 동일 패턴
```

### 2. UI 변경

**파일**: `src/components/tasks/TaskComments.tsx`

- 각 댓글에 **수정(Pencil)** / **삭제(Trash2)** 아이콘 버튼 추가 (작성자 본인 또는 Admin일 때만 표시)
- **수정 모드**: 해당 댓글의 메시지를 인라인 Textarea로 전환, 저장/취소 버튼
- **삭제**: 확인 후 `supabase.from("task_comments").delete().eq("id", commentId)` 실행
- 삭제 시 하위 reply도 cascade 삭제 (DB FK 설정에 의존)
- Realtime 채널에 `UPDATE`, `DELETE` 이벤트도 구독하여 실시간 반영

### 수정 범위
- DB 마이그레이션 1건 (RLS 정책 4개 추가)
- `TaskComments.tsx`: 수정/삭제 UI + 핸들러 추가

