

# Summary 롤업 로직 수정 — 기간 가중 평균 적용

## 1. DB 마이그레이션: `update_summary_progress()` 트리거 함수 수정

현재 `AVG(current_progress)` → 기간 가중 평균으로 변경:

```sql
CREATE OR REPLACE FUNCTION public.update_summary_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_parent_id UUID;
  v_avg INTEGER;
  v_min_start DATE;
  v_max_end DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN v_parent_id := OLD.parent_id;
  ELSE
    v_parent_id := NEW.parent_id;
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id AND OLD.parent_id IS NOT NULL THEN
      SELECT COALESCE(ROUND(
        SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
        / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
      ), 0)::INTEGER, MIN(start_date), MAX(end_date)
      INTO v_avg, v_min_start, v_max_end
      FROM public.tasks WHERE parent_id = OLD.parent_id AND deleted_at IS NULL;
      IF v_min_start IS NOT NULL THEN
        UPDATE public.tasks SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
        WHERE id = OLD.parent_id AND is_summary = true;
      END IF;
    END IF;
  END IF;

  IF v_parent_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(
      SUM(current_progress * GREATEST(1, end_date - start_date + 1))::NUMERIC
      / NULLIF(SUM(GREATEST(1, end_date - start_date + 1)), 0)
    ), 0)::INTEGER, MIN(start_date), MAX(end_date)
    INTO v_avg, v_min_start, v_max_end
    FROM public.tasks WHERE parent_id = v_parent_id AND deleted_at IS NULL;
    IF v_min_start IS NOT NULL THEN
      UPDATE public.tasks SET current_progress = v_avg, start_date = v_min_start, end_date = v_max_end
      WHERE id = v_parent_id AND is_summary = true;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

**변경점**: `AVG(current_progress)` → `SUM(progress × duration) / SUM(duration)`, `deleted_at IS NULL` 조건 추가

## 2. UI: `src/components/tasks/TaskTable.tsx` — Summary의 planned 계산 변경

Line 484 변경:

```typescript
// 현재
const planned = calcPlannedProgress(task.start_date, task.end_date);

// 변경
const planned = isSummary
  ? weightedAvg(
      tasks.filter(t => t.parent_id === task.id && !t.deleted_at),
      t => calcPlannedProgress(t.start_date, t.end_date)
    )
  : calcPlannedProgress(task.start_date, task.end_date);
```

`weightedAvg` import 추가 (`calcPlannedProgress`와 함께 `@/lib/mockData`에서).

정렬 로직(line 296-298)의 `plan`/`gap` 케이스도 동일하게 Summary 분기 적용.

## 변경 파일

| 파일 | 내용 |
|------|------|
| 마이그레이션 SQL | `update_summary_progress()` 기간 가중 평균으로 교체 |
| `src/components/tasks/TaskTable.tsx` | import에 `weightedAvg` 추가, Summary planned를 subtask 가중 평균으로 계산 |

