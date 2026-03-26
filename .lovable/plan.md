

# 사이드바 Activity 카드 클릭 불일치 수정

## 원인

Line 578: `if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;`

카드 내부의 `readonly` INPUT 요소(작업명, 기간, 선행/후행작업, WBS)가 카드 면적의 대부분을 차지합니다. 이 영역 클릭 시 핸들러가 즉시 종료되어 동작하지 않습니다. 좁은 빈 영역(라벨, 배지 등)을 클릭한 경우에만 작동하므로 불일치가 발생합니다.

## 수정: `public/cpm_network.html` (line 578)

```text
변경 전: if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
변경 후: if (e.target.tagName === 'BUTTON') return;
         if (e.target.tagName === 'INPUT' && !e.target.readOnly) return;
```

- BUTTON 클릭(삭제 ×)만 차단
- readonly INPUT 클릭은 카드 클릭으로 처리
- 편집 가능 INPUT은 기존처럼 차단 (편집 모드 보호)

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | line 578 조건문 수정 |

