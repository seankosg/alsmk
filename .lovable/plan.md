
## 1. 엑셀 가중치 적용 로직 (분석 결과)

업로드한 `00_SUMMARY_MDR_progress_260626-4.xlsx` → `Weekly progress` 시트를 모든 수식 단위로 덤프해 확인한 결과, **엑셀은 단 3종류의 가중치만** 사용합니다.

| WF | 위치 | 값 (현재 엑셀) | 적용 대상 |
|---|---|---|---|
| **Stage WF** | S49/T49/U49 (일반), T54/U54 (소방) | SD 0.2 / DD 0.4 / CD 0.4, 소방 DD 0.5 / CD 0.5 | Overall Progress 합성 |
| **Discipline(=Team) WF** | Z54~AE54 (1.1), Z49~AE49 (1.0), Z54~AE54 (3.1) | Arch 0.48 / Stru 0.28 / Mech 0.11 / Fire 0.13 ... | Sub-total 행 |
| **Building WF** | M50/N50/O50/P50, M55~O55, M60~O60 | 총공사비 / Σ 총공사비 (1.0/1.1/1.2 변형) | Total 행 |

각 셀의 수식 패턴:

```text
Disc 행 셀 값      = (그 Disc 도면들의 누적 마일스톤 진행률 평균)        ← 가중치 없음, 도면 평균
                    예) O15 = 0.0103, T15 = 0.2099

Sub-total (Block) = Σ (Disc 셀 × Team WF)
                    예) L20 = L15*Z54 + L16*AA54 + L17*AB54 + L18*AC54

Total (전체)       = Σ (Sub-total × Building WF) + GEN의 FAFP × Fire WF
                    예) O33 = O20*M60 + O26*N60 + O32*O60 + O13*AC49

Overall Progress  = Σ (Stage 셀 × Stage WF)
                    예) AO15 = L15*S49 + AB15*T49 + AN15*U49
```

**결론**: 엑셀은 셀값 자체에는 WF를 곱하지 않고(=도면 평균), **합계(Block/전체)와 Overall 합성**에서만 3축 WF를 곱합니다.

---

## 2. 현재 앱의 상태

| 컴포넌트 | 현재 동작 |
|---|---|
| `summaryEngine.ts` (Design Summary 페이지) | **이미 엑셀과 동일한 3축 WF 적용 완료** — `blockProgress` = Team WF 가중, `overallProgress` = Building WF 가중, Discipline 내 Stage WF 합성 |
| `MdrWeightsEditor` (SUMMARY 가중치 편집) | Stage/Team/Building WF 값을 `mdr_weights`에 저장 — **엑셀의 WF 값 그대로 입력 가능** |
| `MdrMilestoneMonitorPanel` (Design Progress Status 패널) | **WF 토글이 "도면수 가중평균(ON) ↔ 단순평균(OFF)"** 만 전환 — 엑셀의 Stage/Team/Building WF는 **반영 안 됨** ← **여기가 핵심 격차** |

---

## 3. 작업 계획 (간단)

진도율 패널(`MdrMilestoneMonitorPanel`)의 **WF 토글 ON** 동작만 엑셀 방식으로 교체합니다. WF 값은 이미 `mdr_weights`에 저장되어 있으므로 **새 가중치 테이블·임포트·UI 추가 없음**.

### 3-1. 가중치 로드
- `MdrMilestoneMonitorPanel` 상단에서 `useQuery(["mdr_wf_bundle"], loadMdrWeights)`로 `wf = { stage, discipline(Team), building }` 로드 (이미 존재하는 함수 재사용).

### 3-2. 합계행(`renderAggRow`) 수정 — WF ON 분기 추가
현재 `weightedAvg(parts, wfEnabled)`는 ON일 때 도면수 가중. 이 부분을 **합계 종류별로** 분기:

```text
WF ON:
  건물 합계  (variant="building")
    Stage P/A (SD/DD/CD)  = Σ(Disc cell × TeamWF[disc]) / Σ TeamWF[disc]      ← 엑셀 Sub-total
    Overall              = Σ(Stage × StageWF[stage]) / Σ StageWF                ← 엑셀 AO

  공장동 합계 (variant="factory")  =  Σ(BuildingTotal × BuildingWF[bld]) / Σ BuildingWF
  프로젝트 전체 (variant="grand")  =  Σ(BuildingTotal × BuildingWF[bld]) / Σ BuildingWF (전체 건물)

  마일스톤 셀     =  도면 평균 (엑셀과 동일 — WF 없음)

WF OFF:
  현재 단순평균 동작 유지 (변경 없음)
```

특수 규칙:
- **소방(FAFP) Stage WF**: FAFP 행 한정 `FAFP_STAGE_WF`(DD 0.5/CD 0.5) 사용 — 이미 `weights.ts`에 존재.
- **Building WF = 0** 건물: 합산에서 자연 제외 (GEN 등) — 엑셀 동일.

### 3-3. UI / 토글
- 기존 `WF 적용 / 미적용` 스위치 그대로 사용. 추가 버튼 없음.
- 툴팁 문구만 수정: *"WF 적용 — 엑셀 SUMMARY와 동일한 Stage·Team·Building WF 가중. 미적용 — 단순 도면 평균."*

### 3-4. 검증
- WF 편집기에서 엑셀과 같은 값(예: Stage 0.2/0.4/0.4, Team Arch 0.48 등)을 입력 → 패널의 "프로젝트 전체 / 건물 합계 / Overall" 값이 엑셀 Total 행(L33/O33/AO33 …)과 일치하는지 수치 비교.

---

## 변경 범위 요약

| 파일 | 변경 |
|---|---|
| `src/components/mdr/MdrMilestoneMonitorPanel.tsx` | `renderAggRow` 내부에서 WF ON일 때 Team WF / Building WF / Stage WF 가중평균 적용. `loadMdrWeights` 쿼리 추가. 토글 툴팁 문구 수정. |
| (그 외) | **없음** — DB/임포트/타입/엔진 변경 없음 |

이전에 검토했던 A-3(도면별 weight 컬럼) / B안(MH&DWG discipline weight 테이블)은 **모두 폐기**합니다. 엑셀은 도면별·M/H 가중치를 셀에 곱하지 않으며, 앱이 이미 보유한 3축 WF로 충분히 동일 결과를 얻을 수 있음이 수식 분석으로 확인되었기 때문입니다.
