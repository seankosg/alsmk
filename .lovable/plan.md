## 문제
[신규 계산] 클릭 시 `재계산 실패: null value in column "actual_pct" of relation "mdr_milestone_snapshots" violates not-null constraint` 오류 발생.

## 원인
- `mdr_milestone_snapshots.actual_pct` (및 `delta_pct`) 컬럼이 `NOT NULL` 제약.
- 그러나 셀의 `actual`/`delta` 는 **기준일 이후의 미래 마일스톤**(planDate > asOf)인 경우 `null` 로 계산됨 (UI 에서 "-" 표시 용도).
- `saveSnapshot` 이 이 null 값을 그대로 insert → not-null 제약 위반.

## 해결책
DB 컬럼 `actual_pct`, `delta_pct` 를 nullable 로 변경 (의미상 "아직 평가하지 않음" = null 이 자연스러움). `loadLatestSnapshot` 에는 이미 null 처리 코드가 있으므로 추가 코드 변경 불필요.

### 마이그레이션
```sql
ALTER TABLE public.mdr_milestone_snapshots
  ALTER COLUMN actual_pct DROP NOT NULL,
  ALTER COLUMN delta_pct  DROP NOT NULL;
```

## 대안 (선택 안함)
- `saveSnapshot` 에서 null → 0 치환: 미래 마일스톤이 "0% 실적" 으로 잘못 기록되어 스냅샷 재로드 시 의미 왜곡됨.
