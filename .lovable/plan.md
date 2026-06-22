## 근본 원인 (재확정)

CRM Excel의 `SER. NO.` 컬럼은 **비어있지 않습니다**. 4개 시트 2,008행 모두 값이 채워져 있습니다.

진짜 문제는 헤더 매칭 실패입니다.

- Excel 헤더 텍스트: `"SER. NO."` (SER 다음 점과 공백)
- 파서 코드: `findVal("SER.NO.", "SER NO", "Serial No.", "Serial")`
- `findVal`은 substring 매칭(`.includes`)을 쓰는데 `"SER. NO."` 안에는 `"SER.NO."`도 `"SER NO"`도 들어있지 않음
- 결과: `serNo = undefined` → `docBase = "L8Z1-800-EA100-"` (끝이 `-`)
- 같은 PBS/FBS 그룹이 전부 동일 docBase로 충돌 → 262개 파일 내 중복 발생

## 구현

### 1) `src/lib/mdr/parser.ts` — `serNo` 매칭 + `docBase` 생성 규칙 수정

`findVal` substring 매칭 대신 헤더 텍스트에 정규식 매칭을 사용하고, `docBase`는 4개 토큰이 모두 있을 때만 생성합니다.

```ts
const plantId = findVal("Plant ID", "PLANT", "JOB");
const pbs = findVal("PBS", "Area Code", "AREA");
const fbs = findVal("FBS", "Function Code", "FUNCTION", "FUCTION");
// "SER. NO.", "SER.NO.", "SER NO", "Serial" 모두 매칭
const serHeader = headers.find((h) =>
  /^\s*ser\.?\s*no\.?\s*$/i.test(h.text) || /serial/i.test(h.text)
);
const serNo = serHeader ? (cellStr(ws, r, serHeader.col) || undefined) : undefined;

const revRaw = findVal("REV", "REVISION");
const rev = (revRaw && revRaw.trim()) ? revRaw.trim() : "0";

// 4개 토큰이 모두 존재할 때만 docBase 생성 (불완전 키 금지)
const tokens = [plantId, pbs, fbs, serNo].map((t) => (t ?? "").trim());
const docBase = tokens.every((t) => t.length > 0) ? tokens.join("-") : undefined;
const docNo = docBase ? `${docBase}-${rev}` : undefined;
```

### 2) `src/lib/mdr/columnMap.ts` — alias 보강

```ts
const HEADER_ALIASES: Record<string, MdrColumnKey> = {
  // ...기존 항목 유지
  "ser. no.": "serNo",
  "ser.no.": "serNo",
  "ser no.": "serNo",
  "ser no": "serNo",
  "ser.no": "serNo",
};
```

### 3) 잘못 import 된 CRM 부분 데이터 정리

이전 import로 `mdr_drawings`에 잘못 들어간 CRM 일부 행을 삭제합니다 (FK CASCADE로 milestones/progress/revisions 자동 정리).

```sql
DELETE FROM public.mdr_drawings WHERE building_code = 'CRM';
```

## 검증

- 로컬 파싱 재실행 시 `docBase` 충돌 0건 기대
- 4개 시트 모두 정상 import 후 화면에서 `Inserted` 표시 확인