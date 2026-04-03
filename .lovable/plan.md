

# 마일스톤 On/Off 토글 기능

## 개요
`milestones` 테이블에 `is_active` boolean 컬럼을 추가하여 Admin에서 각 마일스톤을 켜고 끌 수 있게 하고, 대시보드 타임라인은 활성화된 마일스톤만 표시합니다.

## 변경 사항

### 1. DB 마이그레이션
- `milestones` 테이블에 `is_active BOOLEAN NOT NULL DEFAULT true` 컬럼 추가

### 2. `src/components/admin/AdminMilestones.tsx`
- 테이블에 "Active" 컬럼 추가
- 각 행에 Switch 토글 배치 — 클릭 시 `is_active` 값을 즉시 업데이트
- 꺼진 마일스톤은 행이 반투명(`opacity-50`)으로 표시

### 3. `src/components/dashboard/MilestoneTimeline.tsx`
- 쿼리에 `.eq("is_active", true)` 필터 추가
- 나머지 로직(균등 배치, 구간별 진행바 보간)은 변경 없음 — 필터링된 목록에 동일하게 적용

## 변경 파일

| 파일 | 내용 |
|------|------|
| DB 마이그레이션 | `is_active` 컬럼 추가 |
| `AdminMilestones.tsx` | Switch 토글 UI + 뮤테이션 |
| `MilestoneTimeline.tsx` | 쿼리에 `is_active = true` 필터 추가 |

