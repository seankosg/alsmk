## 문제
`useMdrImporter` 훅의 상태(`files`, `isRunning`)가 컴포넌트 로컬 `useState`에 있어, 사용자가 `/design/import` 화면을 떠나면 `ImportShell`이 unmount되어 상태가 사라집니다. 다시 돌아오면 진행/완료 정보가 보이지 않고, 진행 중이던 import 작업도 `setState`가 unmounted 컴포넌트에 적용돼 결과가 유실됩니다.

## 해결 방향
Import 상태를 **모듈 레벨 싱글톤 store**로 끌어올려, 같은 SPA 세션 동안 라우트 이동/재방문에도 유지되도록 합니다. (File 객체는 직렬화 불가하므로 sessionStorage 영속화는 하지 않고 인메모리 유지 = 새로고침 시에는 초기화 — 합리적 트레이드오프)

## 변경 사항

### 1. `src/lib/mdr/import/importerStore.ts` (신규)
- `files`, `isRunning` 상태를 보관하는 모듈 싱글톤.
- `subscribe(listener)` / `getState()` / `addFiles()` / `removeFile()` / `clearAll()` / `startImport()` API 제공.
- `useSyncExternalStore`로 React에 연결.
- 현재 `useMdrImporter`의 로직(파일 파싱, validation, persist, 스냅샷 재계산, toast)을 그대로 이관.
- `userId`/`onImported` 콜백은 `startImport(options)` 인자로 받아 호출 시점에 주입.

### 2. `src/components/mdr/import/useMdrImporter.ts`
- 내부 구현을 store 구독으로 교체. 외부 API 시그니처는 그대로 유지(`ImportShell` 변경 불필요).
- `useSyncExternalStore`로 `files`, `isRunning` 반환. action들은 store 메서드를 감싼 형태.

### 3. (UX) 화면 복귀 시 표시
- store가 유지되므로 `ImportShell` 재마운트 시 자동으로 기존 카드/배지(Processing/Done/Failed 등) 그대로 노출.
- "Clear all"은 done/failed/skipped 항목까지 비우므로 그대로 충분.

## 비변경
- `parser`, `persistParsed`, `validateSheet`, `computeMatrix/saveSnapshot` 로직은 손대지 않음.
- 진척률 패널, weights 관련 코드 무관.

## 검증
1. 빌드 통과.
2. 수동 테스트: 큰 파일 업로드 → Start import 클릭 → 다른 페이지로 이동 → 다시 `/design/import` 복귀 → 진행 중/완료 카드가 그대로 보이는지, toast가 적절히 발생하는지 확인.
