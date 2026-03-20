

## Soft Delete + 사용자별 휴지통 (48시간 자동 정리)

### 1. DB 변경 (마이그레이션)

`tasks` 테이블에 컬럼 추가:
```sql
ALTER TABLE public.tasks ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN deleted_by uuid DEFAULT NULL;
```

48시간 자동 정리를 위한 pg_cron 작업 등록 (insert tool 사용):
```sql
-- pg_cron + pg_net 확장 활성화 후
-- 매 시간 실행: deleted_at이 48시간 이상 지난 태스크 영구 삭제
SELECT cron.schedule('cleanup-soft-deleted-tasks', '0 * * * *',
  $$DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '48 hours'$$
);
```

### 2. 삭제 로직 변경

**파일**: `src/components/tasks/TaskDetailDialog.tsx`
- `.delete()` → `.update({ deleted_at: new Date().toISOString(), deleted_by: memberId })`
- Summary 삭제 시 하위 태스크도 동일하게 soft delete
- 삭제 확인 메시지에 "48시간 내 복원 가능" 안내 추가

### 3. 조회 필터 추가

모든 태스크 조회 쿼리에 `.is("deleted_at", null)` 필터 추가 (약 15개 파일):
- `Workspace.tsx`, `TaskTable.tsx`, `MyDashboard.tsx`
- 대시보드 컴포넌트들 (`ProjectHUD`, `CriticalIssueBoard`, `OverdueTasksBoard`, `BehindScheduleBoard`, `TaskDistributionChart`, `IssueTrendChart`, `UpcomingDeadlines`, `TeamHeatmap`, `CategoryProgressChart`, `TeamProgressChart`)
- `CategoryCombobox.tsx`, `TaskImport.tsx`, `Messages.tsx`

### 4. 사용자별 휴지통 UI

**새 컴포넌트**: `src/components/tasks/DeletedTasksList.tsx`
- 현재 사용자가 삭제한 태스크만 표시 (`deleted_by = memberId`)
- Admin은 전체 삭제된 태스크 조회 가능
- 각 태스크에 **복원** 버튼 (deleted_at, deleted_by를 null로) + **영구 삭제** 버튼 (Admin만)
- 남은 시간 표시 (48h - elapsed)

**Workspace에 통합**: Workspace 헤더에 휴지통 아이콘 버튼 → Sheet/Dialog로 삭제된 태스크 목록 표시

### 수정 범위
- DB 마이그레이션 1건 + cron 등록 1건
- `TaskDetailDialog.tsx`: 삭제 로직 변경
- 태스크 조회 ~15개 파일: `.is("deleted_at", null)` 필터 추가
- 새 컴포넌트 1개 (`DeletedTasksList.tsx`)
- `Workspace.tsx`: 휴지통 버튼 추가

