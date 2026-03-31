

# Admin용 MPP 진행률 수동 입력 기능

## 개요

현재 MPP 진행률(`activity.progress`)은 XML에서 파싱된 값을 읽기 전용으로 표시합니다. Admin/PM 사용자가 이 값을 직접 수정하고 DB(`cpm_activities.progress`)에 저장할 수 있도록 합니다.

## 변경 파일: `src/components/cpm/ActivityTaskPanel.tsx`

### 1. MPP 진행률 표시 영역 수정 (약 lines 357-364)

현재 읽기 전용 Progress bar를 조건부 편집 가능하게 변경:
- **일반 사용자**: 기존과 동일 (Progress bar + 텍스트)
- **Admin/PM**: 클릭 시 `<Input type="number">` 표시, 입력 후 Enter 또는 ✓ 버튼으로 저장

### 2. 저장 로직

```typescript
await supabase
  .from("cpm_activities")
  .update({ progress: newProgress })
  .eq("id", dbActivity.id);
```

저장 후:
- query invalidation (`cpm_activity_by_mpp`)
- `onStatusChanged()` 호출 → iframe `refreshStatus` 연동
- iframe에서 해당 노드의 MPP 진행률 표시 갱신

### 3. 영향 범위

- `cpm_activities.progress` 컬럼만 업데이트 (semantic_key 등 다른 필드에 영향 없음)
- iframe 네트워크 노드: 매핑된 태스크가 없는 경우 이 값이 노드에 표시되므로 즉시 반영됨
- 스냅샷: 스냅샷은 iframe 내부 상태를 저장하므로, DB 값 변경은 다음 hydration 시 반영

