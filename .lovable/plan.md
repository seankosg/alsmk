

# 재검토: Unmapped Overdue 감지 — 더 효율적인 방법

## 문제 원인 (재확인)

Activity #111 예시:
1. `batchUpdateElapsedProgress()` → auto-mode, finish_date 지남 → **progress = 100** 으로 DB 저장
2. `progressOverrides`로 iframe에 전달 → `a.progress = 100`
3. `_alertCache` 조건: `a.progress < 100` → `100 < 100` = **false** → 깜박임 미작동

## 기존 제안: `progressModeMap` 전송

- `useCpmViewModel.ts`에서 `progress_mode` 추가 쿼리
- `progressModeMap` 객체를 postMessage로 전송
- iframe에서 `window._progressModeMap` 저장 후 분기 처리

**비효율적인 이유**: 추가 데이터 전송, iframe 전역 변수 추가, 두 파일 수정 필요

## 더 효율적인 방법: iframe 내부에서 해결 (1파일, 1줄 수정)

`progressOverrides` 패칭 **이전**에 원본 progress를 저장해두고, `_alertCache`에서 활용:

```text
현재 흐름:
  hydrate → progressOverrides 패칭 → a.progress = 100 → _alertCache → 감지 실패

개선 흐름:  
  hydrate → 원본 progress 저장 → progressOverrides 패칭 → _alertCache에서 원본 참조
```

**핵심**: iframe hydrate 핸들러에서 `progressOverrides` 적용 직전에 각 activity의 원본 XML progress를 `a._xmlProgress`로 보존. `_alertCache`에서는 `a._xmlProgress`(또는 없으면 `a.progress`)를 사용하여 overdue 판정.

```javascript
// hydrate 핸들러 — progressOverrides 패칭 직전 추가 (1줄)
activities.forEach(function(a) { a._xmlProgress = a.progress; });

// _alertCache 계산 — progress 체크를 원본 기준으로 변경
const origProgress = a._xmlProgress !== undefined ? a._xmlProgress : a.progress;
const isUnmappedOverdue = !hasMappedStatus
  && a.finishDate
  && new Date(a.finishDate) < _todayAlert
  && (origProgress === null || origProgress === undefined || origProgress < 100);
```

**장점**:
- `useCpmViewModel.ts` 변경 **불필요** (추가 쿼리/데이터 전송 없음)
- `cpm_network.html`만 수정 (2곳: hydrate 핸들러 + `_alertCache`)
- Manual 모드에서 수동 입력한 100%도 `progressOverrides`로 들어오지만, XML 원본이 100%가 아니면 올바르게 감지
- Manual 모드에서 수동으로 100% 입력 → `progressOverrides`가 100 → 하지만 XML 원본이 100이면 감지 안 함 (정상)

**한계**: Manual 모드에서 사용자가 진도 100%로 수동 저장 → XML 원본은 0% → 여전히 overdue로 표시됨. 하지만 이 경우 `progressOverrides` 값(100)을 사용해야 하므로 추가 분기 필요.

## 최종 권장: 하이브리드 접근 (iframe만 수정, 정확도 보장)

`progressOverrides`를 `window._progressOverrides`로 저장 (이미 변수로 존재), `_alertCache`에서:

```javascript
const dbProgress = window._progressOverrides?.[a.mppTaskId];
const hasDbProgress = dbProgress !== undefined;
// DB에서 100%로 온 경우 → 완료 간주 (auto든 manual이든)
// DB progress가 없거나 100 미만이면서 finish_date 지남 → overdue
const isUnmappedOverdue = !hasMappedStatus
  && a.finishDate
  && new Date(a.finishDate) < _todayAlert
  && (!hasDbProgress || dbProgress < 100);
```

**문제**: auto-mode에서 `dbProgress = 100` (자동 계산) → 감지 실패. 원점 회귀.

## 결론: `progressModeMap`이 올바른 접근

auto-mode의 100%는 "경과 시간 비율"이지 "실제 완료"가 아니므로, **mode 정보 없이는 구분 불가**합니다. 기존 제안이 가장 정확합니다. 단, 최소화 가능:

### 최소 변경 계획

**`useCpmViewModel.ts`** — 기존 `freshActivities` 쿼리에 `progress_mode` 필드만 추가 (추가 쿼리 불필요):

```typescript
// 기존: .select("mpp_task_id, progress")
// 변경: .select("mpp_task_id, progress, progress_mode")
```

`autoModeIds` 배열을 postMessage에 추가 (progressModeMap 대신 ID 배열만 — 더 가볍):

```typescript
const autoModeIds = freshActivities
  .filter(a => a.progress_mode === 'auto' && a.mpp_task_id)
  .map(a => a.mpp_task_id);
// postMessage에 autoModeIds 추가
```

**`cpm_network.html`** — hydrate/refresh에서 `window._autoModeIds = new Set(data.autoModeIds)` 저장:

```javascript
const isAutoMode = window._autoModeIds?.has(a.mppTaskId);
const isUnmappedOverdue = !hasMappedStatus
  && a.finishDate
  && new Date(a.finishDate) < _todayAlert
  && (isAutoMode || a.progress === null || a.progress === undefined || a.progress < 100);
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/hooks/useCpmViewModel.ts` | 기존 쿼리에 `progress_mode` 추가, `autoModeIds` 배열 전송 |
| `public/cpm_network.html` | `window._autoModeIds` 저장, `_alertCache`에서 auto-mode 분기 |

