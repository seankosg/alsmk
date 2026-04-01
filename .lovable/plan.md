

# CPM 새로고침 불가 — 근본 원인 및 수정

## 근본 원인

`public/cpm_network.html` 1979행에 **`SyntaxError: Illegal return statement`** 발생.

`toggleOverdueFilter()` 함수를 추가하면서 `applyBldgFilter(bldgValue)` 함수의 선언부(`function applyBldgFilter(bldgValue) {`)가 누락됨. 함수 본문(1979~2002행)이 함수 바깥에 노출되어, `return` 문이 전역 스코프에서 실행 → **전체 JavaScript 파싱이 중단** → iframe의 `window.addEventListener('message', ...)` 리스너가 등록되지 않음 → `cpm-hydrate` 메시지를 수신 불가.

**즉, iframe의 JS가 완전히 깨져있어서 어떤 메시지도 수신할 수 없는 상태입니다.**

## 수정

### `public/cpm_network.html` — 1978행

현재 (함수 선언 누락):
```
}  // ← toggleOverdueFilter 닫힘 (line 1976)


  if (!calculated) { ... return; }  // ← line 1979: 전역 스코프의 return → SyntaxError
```

수정 — 1978행에 함수 선언부 추가:
```
}  // ← toggleOverdueFilter 닫힘 (line 1976)

function applyBldgFilter(bldgValue) {
  if (!calculated) { ... return; }
```

## 변경 파일

| 파일 | 내용 |
|------|------|
| `public/cpm_network.html` | 1978행에 `function applyBldgFilter(bldgValue) {` 선언 복원 |

## 부수 효과

이 수정으로 다음 문제들이 모두 해결됩니다:
- 새로고침 버튼 클릭 시 데이터 미로딩
- 페이지 리로드 시 데이터 소실 (iframe ready → hydrate 핸드쉐이크 실패)
- Overdue 필터 버튼 등 모든 iframe 내 기능 정상화

