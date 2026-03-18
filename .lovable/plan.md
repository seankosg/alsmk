
문제 원인은 이미 충분히 특정됐습니다. 지금은 “멤버 계정 생성 로직 전체”가 깨진 것이 아니라, `admin-manage-user` 백엔드 함수의 인증 검증 방식이 현재 런타임/SDK와 맞지 않아 모든 생성 요청이 500으로 실패하고 있습니다.

## 원인 진단

### 실제 실패 지점
네트워크 응답에 원인이 직접 드러납니다.

```text
{"error":"userClient.auth.getClaims is not a function"}
```

즉, 현재 배포된 `supabase/functions/admin-manage-user/index.ts` 안에서 호출하는:

```ts
userClient.auth.getClaims(token)
```

이 메서드가 해당 함수 런타임에서 존재하지 않습니다.

### 왜 이게 원천 원인인가
현재 흐름은 아래와 같습니다.

```text
AdminMembers UI
  -> supabase.functions.invoke("admin-manage-user")
  -> edge function 실행
  -> Authorization 헤더 읽음
  -> userClient.auth.getClaims(token) 호출
  -> 함수 없음 => throw
  -> 500 Internal Server Error
  -> 계정 생성 불가
```

즉:
- 프론트 입력값 문제 아님
- DB 권한 문제 아님
- 멤버 데이터 문제 아님
- CORS 문제 아님
- `verify_jwt = false` 자체도 문제 아님

핵심은 “함수 런타임에서 지원되지 않는 인증 API를 사용한 것”입니다.

## 구현 계획

### 1) `admin-manage-user` 함수의 인증 검증 방식을 안정적으로 교체
파일:
- `supabase/functions/admin-manage-user/index.ts`

수정 방향:
- `getClaims()` 호출 제거
- 현재 런타임에서 확실히 동작하는 방식으로 JWT 검증 통일
- 가장 안전한 후보는 `auth.getUser(token)` 또는 동등한 서버 검증 방식으로 교체
- 검증 성공 시 `user.id`를 callerId로 사용
- 이후 admin role 확인은 지금처럼 service-role 클라이언트에서 `has_role` RPC 호출 유지

이렇게 하면:
- 계정 생성
- 비밀번호 재설정
- admin 권한 토글

세 액션이 모두 같은 인증 버그에서 같이 복구됩니다.

### 2) 함수 내부를 “공통 인증 + 액션 분기” 구조로 정리
현재도 액션 분기는 되어 있지만, 인증/에러 처리가 분산되어 있습니다. 이번에 같이 정리하겠습니다.

구조:
```text
request 수신
  -> env 검증
  -> body/action 파싱
  -> 첫 사용자 여부 확인
  -> 첫 사용자가 아니면 공통 authenticateAdmin() 실행
  -> action별 create / reset-password / toggle-admin 실행
  -> 일관된 JSON 응답 반환
```

효과:
- 같은 인증 실수가 다른 액션에 반복되지 않음
- 추후 관리자 기능 추가 시 재사용 가능
- 500 대신 401/403/400이 정확히 구분됨

### 3) 실패 복구까지 고려한 생성 로직 보강
계정 생성은 외부 인증 계정 생성 + `members` 연결 업데이트의 2단계입니다.

보강 항목:
- `member_id`가 실제 존재하는지 먼저 확인
- 이미 `members.user_id`가 연결된 멤버인지 선검사
- 이메일 중복/생성 실패 시 명확한 메시지 반환
- 인증 계정 생성 후 `members` 업데이트가 실패하면 정리 전략(rollback 또는 명확한 장애 메시지) 적용

이 단계는 “근본 원인”은 아니지만, 지금처럼 한 번 고장 나면 원인 파악이 어려운 상태를 막아줍니다.

### 4) 프론트 호출부는 최소 수정만 검토
파일:
- `src/components/admin/AdminMembers.tsx`

현재 create 액션은 access token을 명시적으로 넣고 있어서 방향은 맞습니다.
다만 아래를 점검/정리합니다.
- 3개 액션(create/reset/toggle-admin) 모두 동일한 인증 전달 방식 사용
- 함수 응답의 `error` 메시지를 그대로 사용자에게 보여주도록 일관화
- “계정 생성 실패”가 아닌 실제 원인(권한 없음, 중복 이메일, 연결된 멤버 없음 등)을 표시

이 단계는 UX 개선이며, 근본 원인은 백엔드 함수 수정입니다.

### 5) 부수 경고도 함께 정리
콘솔에 별도 경고가 있습니다.

#### a. DialogFooter ref 경고
파일:
- `src/components/ui/dialog.tsx`

`DialogFooter`가 일반 함수 컴포넌트인데 ref가 전달되고 있습니다. 이건 현재 계정 생성 실패의 직접 원인은 아니지만, AdminMembers 다이얼로그에서 계속 경고를 만들고 있으므로 함께 정리하는 것이 좋습니다.

#### b. DialogDescription 누락 경고
파일:
- `src/components/admin/AdminMembers.tsx`

각 다이얼로그에 설명 텍스트 또는 `aria-describedby` 처리를 추가해 접근성 경고를 없애겠습니다.

이 둘은 화면 공백 원인의 핵심은 아니지만, 디버깅 신호를 오염시키므로 같이 정리하는 편이 맞습니다.

## 변경 대상 파일

```text
필수
- supabase/functions/admin-manage-user/index.ts

권장
- src/components/admin/AdminMembers.tsx
- src/components/ui/dialog.tsx
```

## 완료 후 기대 결과

```text
Admin > Members
  -> Create Account 클릭
  -> 이메일/비밀번호 입력
  -> 백엔드 함수가 토큰을 정상 검증
  -> auth user 생성
  -> members.user_id / email 연결
  -> 성공 toast 표시
  -> 목록에 Connected 표시
  -> 이후 Admin 권한 토글/비밀번호 재설정도 정상 동작
```

## 기술 메모
- `supabase/config.toml`의 `verify_jwt = false`는 유지하는 방향이 맞습니다.
- 문제는 config가 아니라 함수 코드에서 런타임 미지원 API를 호출한 점입니다.
- DB/RLS 쪽은 이번 오류의 직접 원인이 아닙니다. 실제로 `has_role` RPC와 `user_roles` 조회는 정상 응답 중입니다.
- 따라서 이번 수정의 중심은 DB가 아니라 edge function 인증 계층입니다.
