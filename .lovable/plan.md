

# BLDG 필터 일반사용자 동작 확인 및 수정

## 원인 분석

`public/cpm_network.html` line 2786에서 localStorage 복원 후 `calculate()`를 **forceReadOnly 없이** 호출합니다. 일반적으로 `set-read-only` 메시지는 iframe `onLoad` 후 도착하므로 init `calculate()`보다 늦지만, 타이밍에 따라 `set-read-only`가 먼저 도착하면 `calculate()`가 `_readOnly` 가드에 의해 차단되어 `calculated = false` 상태가 유지됩니다. 이 경우 BLDG/WBS 필터 모두 `if (!calculated)` 가드에 걸려 작동하지 않습니다.

## 수정: `public/cpm_network.html`

### Line 2786: `calculate()` → `calculate(true)`

```javascript
// 변경 전
calculate();

// 변경 후  
calculate(true);
```

localStorage 복원 후의 `calculate()`는 데이터를 다시 계산하는 것이므로 read-only 여부와 무관하게 실행되어야 합니다. DB 스냅샷 복원(line 2960)과 동일하게 `forceReadOnly` 플래그를 전달합니다.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | line 2786: `calculate()` → `calculate(true)` |

