## 목표
1. 최초 Rev 기본값을 `"0"` → `"A"`로 통일 (코드 + 기존 데이터 1회 마이그레이션)
2. 임포트 시 엑셀의 `REV. NO.` 컬럼 값을 그대로 신뢰하여 Latest Rev로 적용 (이미 동작 중인 로직 보강 및 명시화)

---

## 1) 데이터 일괄 마이그레이션 (1회)

대상: 모든 `rev = '0'`인 기존 행을 `'A'`로 변경.

```sql
-- mdr_drawings: rev '0' → 'A', doc_no 재생성
UPDATE public.mdr_drawings
SET rev = 'A',
    doc_no = doc_base || '-A'
WHERE rev = '0' OR rev IS NULL;

-- mdr_drawing_revisions: 과거 스냅샷도 동일 처리 (현재 0건이지만 안전망)
UPDATE public.mdr_drawing_revisions
SET rev = 'A',
    doc_no = doc_base || '-A'
WHERE rev = '0' OR rev IS NULL;
```

확인: 마이그레이션 후 `SELECT count(*) FROM mdr_drawings WHERE rev='0'` → 0이어야 함.

현재 DB 상태: `mdr_drawings` 4,176건 모두 `rev='0'` (이전 임포트에서 REV.NO. 헤더 인식 실패로 기본값 적용된 결과). 이 데이터는 헤더 매핑 수정 전 임포트본이므로, 마이그레이션 후 실제 엑셀 재임포트 시 정상 Rev 값(A, B, …)으로 덮어쓰여짐.

---

## 2) 코드 변경 (기본값 `"0"` → `"A"`)

### `src/lib/mdr/parser.ts`
- L22 주석: `없으면 "0"` → `없으면 "A"`
- L395: `const rev = (revRaw && revRaw.trim()) ? revRaw.trim() : "A";`

### `src/lib/mdr/importRunner.ts`
기존 행의 rev 비교/표기에 쓰이는 fallback도 통일:
- `(existing.rev ?? "0")` 출현 3개소 → `(existing.rev ?? "A")`
- Rev 변경 스냅샷 payload의 `rev: ex.rev ?? "0"`, `doc_no: ...${ex.rev ?? "0"}` → `"A"`

### 기타 표시 코드
`rev ?? "0"` / `|| "0"` 패턴이 남아있는지 grid/exporter 등을 일괄 grep 후 동일하게 `"A"`로 변경.

---

## 3) 임포트 시 Rev 적용 로직 (이미 정상, 명시화만)

`importRunner.ts`의 동작을 다음과 같이 확정:

| 매칭 키 `(building_code, doc_base)` | 엑셀 Rev | 기존 Rev | 처리 |
|---|---|---|---|
| 신규 | (그대로) | — | **insert** — 엑셀 Rev = Latest |
| 동일 | 같음 | 같음 | skip_same_rev (메타/마일스톤 재동기화) |
| 동일 | 다름 (예: 엑셀 B, DB A) | 기존 | **rev_update** — 기존 행을 `mdr_drawing_revisions`로 이력 보관 → `mdr_drawings.rev`를 엑셀 값으로 덮어쓰기 (Latest = 엑셀) |

→ "엑셀 우선" 원칙은 이미 코드에 반영되어 있음. base‑26(A→Z→AA) 비교 로직은 **불필요** (엑셀 값을 무조건 신뢰하므로 정렬/대소 비교 없음).

### 보강할 한 가지
Rev 정규화: 엑셀 셀이 소문자(`a`)나 공백 포함(`A `)으로 들어올 수 있으므로 `parser.ts`에서 `rev = revRaw.trim().toUpperCase()` 적용 (숫자 Rev가 들어와도 그대로 보존, 대문자만 강제).

---

## 변경 파일
- `supabase/migrations/<new>.sql` — 데이터 UPDATE 1회
- `src/lib/mdr/parser.ts` — 기본값 "A", toUpperCase 정규화
- `src/lib/mdr/importRunner.ts` — fallback "0" → "A" 일괄 치환
- (필요 시) `src/lib/mdr/exporter.ts`, `src/components/mdr/grid/columns.tsx` — 표시용 fallback 동일 치환

## 범위 외 (변경하지 않음)
- Rev 자동 증분, 단계‑Rev 매핑, base‑26 정렬/비교 로직 — 사용자 결정에 따라 도입하지 않음.
- 헤더 매핑 보강(이전 단계 plan)은 별도 사안.
