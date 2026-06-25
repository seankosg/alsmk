---
name: Building Categories
description: 건물 분류 (공장동/사무동) 및 마일스톤 모니터 합계 계층 정의
type: feature
---

# 건물 분류

## 분류
- **공장동 (5개)**: `GEN`, `SMP&CCM`, `HSM`, `CRM`, `FAFP`
- **사무동 (1개)**: `MAIN_OFFICE`
- **프로젝트 전체** = 공장동 + 사무동

## 고정 정렬 순서
`GEN → SMP&CCM → HSM → CRM → FAFP → MAIN_OFFICE`

## 마일스톤 모니터 합계 3계층
1. **건물 합계** — 각 건물 행 그룹 직후 (연한 주황)
2. **공장동 합계** — FAFP 합계행 직후 1회 (중간 톤 주황) = 공장동 5개 합산
3. **프로젝트 전체** — 테이블 맨 아래 (진한 주황) = 공장동 + MAIN_OFFICE

## 위치
- 상수: `BUILDING_ORDER`, `FACTORY_BUILDINGS`, `LAST_FACTORY_BUILDING` in `src/components/mdr/MdrMilestoneMonitorPanel.tsx`
