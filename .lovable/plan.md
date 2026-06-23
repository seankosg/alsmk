## 문제
임포트 후 Plant ID 컬럼이 비고 Doc.No 첫 토큰(`L0Z1` 등)이 누락됩니다.

## 원인
`src/lib/mdr/parser.ts`의 `headerTextAt(col)` 헬퍼가 **row 4를 우선**, 비어 있을 때만 row 5로 폴백합니다.

GEN(및 모든 빌딩) 파일의 ARCH 시트는 `C4:G4`가 "DWG. NO" 한 셀로 가로 병합되고, 실제 서브헤더(PLANT ID/PBS/FBS/SER.NO./REV.NO.)는 row 5에 있습니다. 병합 셀의 값은 좌상단(C4)에만 존재하므로:

- C열: row4="DWG. NO", row5="PLANT ID" → 현재 로직은 **"DWG. NO"** 사용 → `findVal("Plant ID")` 실패 → Plant ID 빈값
- D~G열: row4=빈값 → row5 폴백 → "PBS"/"FBS"/"SER. NO."/"REV. NO." 정상

## 수정 방안
`headerTextAt(col)`의 우선순위를 **row 5(서브헤더) → row 4(그룹헤더)** 로 뒤집습니다. 단, row 5 텍스트가 마일스톤 라벨(`SD50%` 등, `MILESTONE_RE` 매칭)이면 row 4로 폴백합니다.

```ts
const headerTextAt = (col: number): string => {
  const t5 = milestoneLabelRow !== headerRow ? cellStr(ws, milestoneLabelRow, col) : "";
  if (t5 && !MILESTONE_RE.test(t5)) return t5;   // 서브헤더 우선
  const t4 = cellStr(ws, headerRow, col);
  if (t4) return t4;
  return t5;
};
```

검증된 효과:
- C열 → "PLANT ID" ✅ (이전: "DWG. NO")
- D/E/F/G → 동일하게 정상
- A/B/H/I/J/K/L 등 row5가 비거나 마일스톤인 컬럼 → 기존과 동일하게 row4 값 사용
- 마일스톤 그룹 경계 판정(`isIdentHeader`)에도 동일 헬퍼가 쓰이지만, 마일스톤 셀은 `MILESTONE_RE`로 걸러져 영향 없음

## 변경 파일
- `src/lib/mdr/parser.ts` (헬퍼 1개, ~5줄)

## 후속
수정 후 5개 파일 모두 재임포트하면 Plant ID 및 Doc.No 첫 토큰이 채워집니다. DB 마이그레이션 없음.
