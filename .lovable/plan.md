

# KUKU Predecessor Watch 중복 제거

## 원인
중복 방지 키가 `${predAct.id}::${ka.id}` (선행+후행 쌍)이므로, 동일 선행 Activity가 여러 KUKU Activity의 predecessor이면 각각 별도 행으로 표시됨.

## 수정 방안

### `src/hooks/useKukuDashboard.ts`

1. **PredecessorInfo 인터페이스 변경**:
   - `kukuSuccessorName: string` → `kukuSuccessorNames: string[]` (복수형)

2. **중복 방지 키를 `predAct.id`만으로 변경**:
   - 같은 선행 Activity가 이미 추가되었으면, 기존 항목의 `kukuSuccessorNames` 배열에 후행 이름만 추가
   - 새로운 선행이면 신규 항목 생성

```typescript
// 기존
const key = `${predAct.id}::${ka.id}`;

// 변경
const key = predAct.mpp_task_id || predAct.id;
const existing = predInfoMap.get(key);
if (existing) {
  existing.kukuSuccessorNames.push(ka.name);
  return;
}
```

### `src/components/dashboard/KukuPredecessorWatch.tsx`

- `p.kukuSuccessorName` → `p.kukuSuccessorNames.join(", ")` 표시
- 여러 KUKU에 영향을 미치는 경우 "→ KUKU-A, KUKU-B" 형태로 표시

### `src/components/dashboard/CpmSummaryBanner.tsx`
- `kukuSuccessorName` 참조가 있으면 `kukuSuccessorNames`로 변경

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useKukuDashboard.ts` | 중복 키를 선행 ID만으로 변경, `kukuSuccessorNames` 배열화 |
| `src/components/dashboard/KukuPredecessorWatch.tsx` | 복수 후행 이름 표시 |

