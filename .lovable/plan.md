## 문제
SMP&CCM ARCH 시트의 모든 도면이 DD 진행률 0%로 표시됨. (No.5는 실제로 DD50%까지 진행됨)

## 원인
- 첫 import 실패로 `mdr_drawings`는 생성됐지만 `mdr_milestones`/`mdr_progress`는 생성되지 못함
- 두 번째 성공한 import에서 Rev가 동일 → `skip_same_rev` 분류 → milestone/progress를 다시 쓰지 않음
- `skip_same_rev` 경로에 milestone/progress 동기화 로직이 없음

## 수정 방안
1. `importRunner.ts`의 `skip_same_rev` 도면도 milestone/progress를 DELETE 후 재삽입하도록 변경
2. 동작은 멱등적(idempotent) — 같은 데이터를 다시 import해도 결과 동일
3. 6개 파일 재import로 누락된 1,621개 도면의 milestone/progress 복구

## 검증
재import 후 모든 빌딩의 `drawings = with_milestones = with_progress` 확인, SMP&CCM ARCH No.5의 DD 50% UI 표시 확인

## 영향
- 수정 파일: `src/lib/mdr/importRunner.ts` (단일 파일)
- DB 스키마 변경 없음