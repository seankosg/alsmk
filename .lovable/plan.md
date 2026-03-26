

# CPM 권한 체계 분석 및 읽기 전용 모드 제안

## 현재 권한 구조

| 기능 | 현재 권한 | 비고 |
|------|-----------|------|
| XML 업로드 | **누구나** | iframe 내부 UI, 제한 없음 |
| CPM 계산 (▶ 버튼) | **누구나** | iframe 내부, 제한 없음 |
| DB 자동저장 (cpm_snapshots INSERT/UPDATE) | **Admin/PM** | RLS로 제한됨 |
| DB 스냅샷 수동저장 | **Admin** | SnapshotManager UI에서 `isAdmin` 체크 |
| 스냅샷 삭제 | **Admin** | SnapshotManager UI에서 `isAdmin` 체크 |
| 스냅샷 불러오기 | **누구나** | SELECT는 authenticated 전체 허용 |
| cpm_activities UPSERT/DELETE | **Admin/PM** | RLS로 제한됨 |
| cpm_task_mappings 편집 | **누구나** | RLS가 ALL:authenticated, UI에서 assignee/admin 체크 |
| Activity 사이드패널 보기 | **누구나** | 노드 클릭 |

**핵심 문제**: iframe 내부의 XML 업로드, 계산 버튼, 샘플 데이터, 초기화 등은 프론트엔드 제한이 없어서 일반 사용자도 조작 가능. 단, DB 쓰기(activities, snapshots)는 RLS가 막으므로 **계산해도 저장 실패**하는 어중간한 상태.

## 개선 제안: Admin/PM 전용 편집 모드 + 일반 사용자 읽기 전용 모드

### 접근 방식

iframe에 `readOnly` 모드를 전달하여 일반 사용자에게는 편집 UI를 숨기고, 최신 스냅샷을 자동 로드 후 렌더링만 수행.

```text
Admin/PM 접속:
  iframe 로드 → DB 최신 스냅샷 복원 → XML 업로드/계산/편집 가능 → DB 저장

일반 사용자 접속:
  iframe 로드 → DB 최신 스냅샷 복원 → 네트워크 렌더링만 표시
  (XML 업로드, 계산 버튼, 샘플, 초기화 숨김)
```

### 변경 파일 및 내용

#### 1. `src/pages/CpmScheduler.tsx`
- `useAuthContext()`에서 `isAdminOrPm` 가져오기
- iframe `onLoad`에서 `{ type: "set-read-only", readOnly: !isAdminOrPm }` 메시지 전송
- 일반 사용자: `cpm-calculated`, `snapshot-save` 메시지 무시 (DB 쓰기 차단)
- 일반 사용자: SnapshotManager 숨기기 (또는 불러오기만 가능하게)

#### 2. `public/cpm_network.html`
- `window._readOnly = false` 전역 변수 추가
- `set-read-only` 메시지 수신 시 `_readOnly = true` 설정 후:
  - `.upload-zone` 숨기기 (`display: none`)
  - `.btn-calc` (CPM 계산 버튼) 숨기기
  - `.btn-sample` (샘플 데이터 버튼) 숨기기
  - 사이드바의 Activity 추가/편집/삭제 버튼 숨기기
  - 초기화 버튼 숨기기
- `calculate()` 함수 시작부에 `if (_readOnly) return` 가드 추가
- `postSnapshotSave()` 시작부에 `if (_readOnly) return` 가드 추가

#### 3. `src/components/cpm/SnapshotManager.tsx`
- 일반 사용자: 저장/삭제 버튼 완전 숨기기 (현재는 `isAdmin`만 체크 → `isAdminOrPm`으로 통일)
- 일반 사용자에게는 Snapshots 버튼 자체를 숨기거나, 목록 읽기 + 불러오기만 허용

#### 4. `src/components/cpm/ActivityTaskPanel.tsx`
- 일반 사용자: "Map Tasks" 버튼 숨기기 (매핑 편집 권한 없음)
- 기존 매핑 해제(X) 버튼은 이미 assignee/admin 체크하고 있으므로 유지

### 일반 사용자 자동 로드 흐름

1. iframe `onLoad` → parent가 `set-read-only` 메시지 전송
2. iframe이 `request-db-snapshot` 메시지 발신 (기존 로직)
3. parent가 DB에서 최신 스냅샷 조회 → `snapshot-restore`로 iframe에 전송
4. iframe이 `_restoreSnapshot()`으로 네트워크 렌더링
5. 읽기 전용이므로 편집 UI는 숨겨진 상태로 네트워크만 표시

이 방식은 별도 "계산"이 불필요합니다. 스냅샷에 이미 계산된 결과(노드 위치, ES/EF/LS/LF 등)가 포함되어 있으므로 복원 즉시 완전한 네트워크가 표시됩니다.

