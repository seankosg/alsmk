

# Custom Fields 편집 시 영향받는 데이터/로직 분석

## 영향 범위 요약

Text1, Text2(BLDG) 값을 수정하면 다음 5개 영역이 영향을 받습니다.

### 1. Semantic Key (시맨틱 키) — ⚠️ 가장 중요
- **파일**: `CpmScheduler.tsx` → `getSemanticKey()`
- **구조**: `BLDG::WBS_L2::Name` (BLDG = Text2)
- **영향**: Text2/BLDG를 변경하면 semantic_key가 바뀜 → 다음 XML 업로드 시 **고아 Activity 자동 이전 매칭이 실패**할 수 있음
- **대응**: 저장 시 `cpm_activities.semantic_key`도 함께 재계산하여 DB 업데이트 필요

### 2. iframe 네트워크 노드 표시
- **파일**: `cpm_network.html`
- **영향**: 노드 카드에 BLDG 뱃지, 사이드바 카드에 BLDG/Text1 뱃지 표시
- **대응**: 저장 후 `refreshStatus()` 호출 → `customFieldsMap` 갱신 → iframe에 `cpm-status-refresh` 전송. 다만 현재 `cpm-status-refresh`는 활성 그래프 내 `customFields`를 오버라이드하므로 DB 업데이트만 하면 반영됨

### 3. 필터 시스템 (BLDG 필터, Text1 필터)
- **파일**: `cpm_network.html` → `applyBldgFilter()`, `applyText1Filter()`
- **영향**: BLDG/Text1 값이 바뀌면 필터 뱃지 목록과 필터링 결과가 변경됨
- **대응**: `refreshStatus()` 후 네트워크 redraw 시 자동 반영 (필터 뱃지는 `renderSidebar()` 재실행 시 갱신)

### 4. Hydration & customFieldsMap
- **파일**: `useCpmViewModel.ts` lines 122-128
- **구조**: `customFieldsMap[mppTaskId::wbsFull] = custom_fields`
- **영향**: DB의 custom_fields가 변경되면 다음 hydration/refresh 시 iframe에 새 값이 전달됨
- **대응**: 저장 후 `refreshStatus()` 호출이면 충분

### 5. 경고 시스템 (Alert Navigation)
- **파일**: `cpm_network.html` → 경고 드롭다운 목록
- **영향**: 드롭다운에 `BLDG · WBS · Name` 형식으로 표시 → BLDG 값 변경 시 표시명 변경
- **대응**: 네트워크 redraw 시 자동 반영

## 구현 시 필수 반영 사항

| 작업 | 설명 |
|------|------|
| DB update `custom_fields` | `cpm_activities` JSONB 컬럼 업데이트 |
| DB update `semantic_key` | BLDG(Text2) 변경 시 `BLDG::WBS_L2::Name` 재계산하여 함께 업데이트 |
| `refreshStatus()` 호출 | iframe에 변경된 customFields 전파 |
| query invalidation | `cpm_activity_by_mpp` 캐시 무효화 |

## 결론

기존에 승인된 계획에 **semantic_key 재계산 및 동시 업데이트**만 추가하면 됩니다. 나머지(필터, 경고, 노드 표시)는 `refreshStatus()` 체인으로 자동 반영됩니다. 구현을 진행할까요?

