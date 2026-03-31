

# Activity별 MPP 진행률 Auto/Manual 토글 — 확인 사항 반영

새 XML 업로드 시 기본 모드 `auto` 동작은 이미 계획에 포함되어 있습니다:

- DB 컬럼: `progress_mode TEXT NOT NULL DEFAULT 'auto'`
- `upsertActivities`/`upsertActivitiesOnly`에서 `progress_mode`를 명시하지 않으므로 DB 기본값 `'auto'` 자동 적용
- 기존 activity들도 마이그레이션 시 `DEFAULT 'auto'`로 설정됨

기존 승인된 계획대로 구현을 진행합니다:

1. **DB 마이그레이션**: `cpm_activities`에 `progress_mode` 컬럼 추가 (DEFAULT 'auto')
2. **useCpmViewModel.ts**: `batchUpdateElapsedProgress`에서 `progress_mode = 'auto'`인 activity만 필터
3. **ActivityTaskPanel.tsx**: activity별 Auto/Manual Switch 토글 + 모드에 따른 편집 제어
4. **CpmScheduler.tsx**: 전역 토글을 일괄 전환 기능으로 변경

