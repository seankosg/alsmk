

## 현재 상태 분석

이미 구현되어 있습니다. 현재 Import 로직에서:

1. **Assignee 컬럼** 인식: `HEADER_ALIASES`에 `"assignee"` 키가 이미 매핑되어 있음
2. **이름 매칭**: Excel의 assignee 이름으로 `members` 테이블에서 매칭하여 `assigneeId` 설정 (line 224)
3. **DB 저장**: `assignee_id`가 task에 저장됨 (line 263)
4. **Workspace 필터**: `TaskTable`의 `filterMine` prop이 `assignee_id === memberId`로 필터링

즉, Admin이 Excel에 **Assignee** 컬럼을 포함하고 멤버 이름을 입력하면, 해당 멤버의 Workspace에 자동으로 표시됩니다.

### 추가로 개선할 부분

현재는 Assignee 이름으로 멤버를 찾으면 `assignee_id`만 설정하고, **team_id와 part_id는 해당 멤버의 소속이 아닌 import한 사람(admin)의 소속**으로 설정됩니다. 이를 개선해야 합니다:

**Assignee 이름이 있을 때 → 해당 멤버의 team_id, part_id도 자동 반영**

### 변경 내용

**`src/components/tasks/TaskImport.tsx`**:
- Assignee 이름으로 멤버를 찾았을 때, teamCode/partCode가 Excel에 없으면 해당 멤버의 `team_id`와 `part_id`를 사용하도록 로직 수정
- Team 해석 순서: Excel teamCode → assignee의 team → importer fallback
- Part 해석 순서: Excel partCode → assignee의 part → importer fallback

이렇게 하면 Admin이 Assignee 컬럼에 "이성호 CM"을 입력하면, task code가 해당 멤버의 팀/파트 기준(`PNE-PCI-...`)으로 생성되고, 해당 멤버의 Workspace에 표시됩니다.

