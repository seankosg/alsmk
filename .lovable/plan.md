## 신버전 감지 알림: 토스트 → 팝업(Dialog)으로 변경

### 변경 대상
- `src/components/BuildInfo.tsx` — 폴링 후 신버전 감지 시 `toast.info(...)` 호출 부분
- `src/main.tsx` — PWA Service Worker `onNeedRefresh` 콜백의 `toast.info(...)` 호출 부분

두 곳 모두 동일한 신버전 알림을 띄우므로, 일관성 있게 같은 팝업으로 통합합니다.

### 구현 방법

1. **`NewBuildDialog` 컴포넌트 신설** (`src/components/NewBuildDialog.tsx`)
   - shadcn `AlertDialog` 사용 (이미 프로젝트에 존재, 다크 테마 호환)
   - 전역 이벤트 `window.dispatchEvent(new CustomEvent("new-build-available"))` 를 수신해서 열림
   - 내용:
     - 제목: "새 버전이 배포되었습니다"
     - 설명: "최신 기능과 버그 수정을 적용하려면 페이지를 새로고침해주세요. 작성 중인 내용은 저장 후 진행하세요."
     - Footer: `나중에` (Cancel, 닫기만) / `지금 새로고침` (Action, `window.location.reload()` 또는 PWA의 `updateSW(true)`)
   - 사용자가 "나중에"를 눌러 닫아도 BuildInfo 칩은 계속 펄스 상태로 남아 언제든 새로고침 가능

2. **`AppLayout`에 `<NewBuildDialog />` 마운트** (`src/components/layout/AppLayout.tsx`)
   - 로그인된 사용자 전 영역에서 한 번만 렌더

3. **트리거 변경**
   - `BuildInfo.tsx`: 신버전 감지 시 `toast.info(...)` 제거 → `window.dispatchEvent(new CustomEvent("new-build-available"))` 로 교체. 칩 펄스 효과는 유지.
   - `main.tsx`의 `registerSW({ onNeedRefresh })`: 토스트 대신 동일 이벤트 dispatch. `updateSW` 함수 참조를 전역(`window.__updateSW`)에 노출시켜 다이얼로그가 PWA 갱신을 트리거할 수 있도록 함.

4. **중복 방지**
   - 다이얼로그는 한 세션에 한 번만 자동으로 열림 (state로 가드). 사용자가 닫은 뒤에는 BuildInfo 칩 클릭으로 즉시 새로고침 유도.

### 동작 시나리오
- 사용자가 탭을 열어둔 상태에서 새 배포 발생 → 5분 폴링 또는 SW 감지 → 화면 중앙에 모달 팝업 표시 → "지금 새로고침" 클릭 시 즉시 reload, "나중에" 클릭 시 닫히고 헤더 칩만 펄스 상태 유지.

### 영향 범위
- 시각적 변경만 (토스트 → 모달). 비즈니스 로직, 데이터, RLS, 빌드 파이프라인에 영향 없음.
