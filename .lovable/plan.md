

## CPM 네트워크 공정표 코드 리뷰 — 발견된 개선사항

2,694줄의 코드를 전체 검토한 결과, **버그 3건, 기능 개선 7건, 코드 품질 개선 4건**을 발견했습니다.

---

### 버그 (즉시 수정 필요)

**1. `applyWbsFilter()`에서 `_wbsNames` 초기화 오류 (Line 1403)**
전체 보기로 토글할 때 `window._wbsNames = {}`로 초기화해버려서, WBS 탭의 Summary Task 이름이 모두 사라집니다.
```
// 현재 (버그)
window._wbsNames = {};
// 수정: 이 줄 삭제 — _wbsNames는 필터와 무관
```

**2. Backward Pass에서 SF 링크 타입 계산 오류 (Line 851)**
SF(Start-to-Finish) 관계에서 `sa.ls - lag` 대신 `sa.lf - lag`가 되어야 합니다. 현재는 SS와 동일하게 처리되어 SF 관계의 Late 값이 부정확합니다.
```
// 현재: else if (p.type==='2') lf_cands.push(sa.ls - lag);  // SF (잘못됨)
// 수정: else if (p.type==='2') lf_cands.push(sa.lf - lag);  // SF
```

**3. `getOrder()` 함수에서 `predLinks` 미사용 (Line 1419-1443)**
`applyWbsFilter()`가 호출하는 `getOrder()`는 `predecessors` 필드만 파싱하고 `predLinks`를 무시합니다. XML 업로드 데이터는 `predLinks`에 의존하므로, WBS 필터 후 네트워크가 깨질 수 있습니다.

---

### 기능 개선

**4. 상대 공기 모드에서 FS 링크만 지원 (Line 882-897)**
수동 입력 모드의 Forward/Backward pass가 링크 타입(SS/FF/SF)과 lag를 완전 무시합니다. 사용자가 `A01:SS:2` 형식으로 입력해도 FS로만 계산됩니다.

**5. SVG `<defs>` 중복 생성 (Line 1039-1044)**
화살표마다 `<defs><marker>` 블록을 생성합니다. Activity가 260개면 수백 개의 중복 마커가 SVG에 삽입됩니다. 마커를 미리 4개(CP/일반 × 색상)만 정의하고 재사용하면 렌더링 성능이 개선됩니다.

**6. Gantt 차트에서 Activity ID가 내부 ID(A001) 표시**
네트워크와 WBS에서는 `mppTaskId`(#3, #21 등)를 표시하지만, Gantt 차트(Line 1238)에서는 `a.id`(A001)를 표시합니다. 일관성 필요.

**7. `switchTab()` 에서 `event` 암시적 참조 (Line 1581)**
`event.target.classList.add('active')`에서 `event`를 매개변수로 받지 않고 전역 `event`를 사용합니다. strict mode나 일부 브라우저에서 동작하지 않을 수 있습니다.

**8. Milestone(0일) 처리 불완전**
Forward pass에서 duration=0인 마일스톤의 ES=EF이지만, Gantt 바 너비가 0%가 되어 보이지 않습니다. 최소 2px 너비 또는 다이아몬드 마커 표시가 필요합니다.

**9. `addWorkDays()` 함수 미구현 (Line 901)**
상대 공기 모드에서 착공일이 설정된 경우 `addWorkDays()`를 호출하지만, 이 함수가 코드에 정의되어 있지 않아 에러가 발생합니다.

**10. 대규모 데이터 렌더링 성능**
260개 Activity에서 SVG 노드를 문자열 연결로 생성합니다. 500개 이상이면 렌더링이 느려질 수 있습니다. 가상 스크롤이나 canvas fallback을 고려할 수 있습니다.

---

### 코드 품질

**11. XSS 취약점 — Activity 이름이 HTML로 직접 삽입**
`a.name`이 SVG/HTML에 escape 없이 삽입됩니다 (Line 1096, 1372 등). 사용자가 `<script>` 태그가 포함된 이름을 입력하면 위험합니다.

**12. `_uid` 내부 필드가 저장/복원 사이클에서 누락**
XML 업로드 시 `_uid`가 설정되지만, `saveToStorage()`에서 직렬화할 때 포함되나 second pass 이후에는 의미가 없습니다. 불필요한 데이터가 localStorage를 차지합니다.

**13. 전역 변수 남용**
`activities`, `idCounter`, `calculated`, `_autoCalc` 등 모든 상태가 전역입니다. iframe 임베딩 시에는 문제없지만, 향후 React 통합 시 모듈화가 필요합니다.

**14. 날짜 파싱 함수 중복**
`parseDateTmp` (Line 1650)와 `parseDate` (Line 1694)가 동일한 로직으로 중복 정의되어 있습니다.

---

### 우선순위별 정리

| 우선순위 | 항목 | 영향도 |
|---------|------|--------|
| **P0 (버그)** | #1 WBS 이름 초기화, #2 SF backward pass, #3 getOrder predLinks | 계산 정확도 |
| **P0 (버그)** | #9 addWorkDays 미구현 | 착공일 설정 시 크래시 |
| **P1 (기능)** | #4 상대 공기 링크 타입, #6 Gantt ID 일관성, #8 마일스톤 표시 | 사용성 |
| **P2 (품질)** | #5 SVG 성능, #7 event 참조, #11 XSS | 안정성/보안 |
| **P3 (향후)** | #10 대규모 렌더링, #13 모듈화 | Phase 2+ 대비 |

이 개선사항들을 반영한 후 앱에 통합하면 됩니다. 수정 작업을 진행할까요?

