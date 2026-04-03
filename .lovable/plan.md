

# Milestone Timeline 쿼리 정렬 수정

## 변경 내용

### `src/components/dashboard/MilestoneTimeline.tsx` (line 21)

현재:
```typescript
const { data, error } = await supabase.from("milestones").select("*").order("sort_order");
```

변경:
```typescript
const { data, error } = await supabase.from("milestones").select("*").is("deleted_at", null).order("target_date");
```

- `order("sort_order")` → `order("target_date")`: Admin 패널과 동일한 날짜 기준 정렬
- `.is("deleted_at", null)` 추가: 소프트 삭제된 마일스톤 필터링 (Admin 패널과 일관성)

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/MilestoneTimeline.tsx` | 쿼리 정렬 및 삭제 필터 수정 (1줄) |

