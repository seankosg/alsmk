

# 일반사용자 로딩 오버레이 & BLDG 필터 수정

## 원인 분석

**시나리오**: 일반사용자가 새 브라우저(localStorage 없음)로 접속 시:

1. iframe init → localStorage 없음 → 부모에게 `request-db-snapshot` 요청 → **오버레이 표시**
2. iframe onLoad → 부모가 `set-read-only` (readOnly=true) 전송 → `_readOnly = true`
3. 부모가 DB에서 스냅샷 조회 → `snapshot-restore` 전송 → **정상 동작** ✅

**하지만 DB에 스냅샷이 없거나 로드 실패 시:**

4. 10초 타임아웃 발동 → `loadSample(); calculate();` (line 2794)
5. `calculate()`가 `_readOnly` 가드에 의해 **차단** → `calculated = false` 유지
6. 모든 필터가 `if (!calculated)` 가드에 걸려 **작동 불가**

**또 다른 시나리오**: DB 스냅샷이 존재하지만 `loadSnapshotFromDb`에서 에러 발생 시에도 동일한 문제 발생.

## 수정: `public/cpm_network.html`

### Line 2794: 타임아웃 폴백에서 `calculate()` → `calculate(true)`

```javascript
// 변경 전
if (!calculated) { loadSample(); calculate(); }

// 변경 후
if (!calculated) { loadSample(); calculate(true); }
```

read-only 사용자도 데이터를 **보기 위해** 계산은 실행되어야 합니다. DB에서 복원할 때도 `calculate(true)`를 사용하는 것과 동일한 논리입니다.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | line 2794: 타임아웃 폴백 `calculate()` → `calculate(true)` |

