## 문제

`src/lib/mdr/progressIcon.ts`의 `buildSeq`가 DD/CD 그룹 모두 `prevDone = true`로 시작합니다. 이 때문에 CD30은 DD가 전혀 진행되지 않았어도 `prevDone=true` → **WIP**로 분류됩니다.

## 수정 방안 (옵션 A: DD100 완료 연쇄)

CD 그룹의 초기 `prevDone`을 **DD100이 done인지 여부**로 설정합니다.

### 변경 파일
- `src/lib/mdr/progressIcon.ts`

### 변경 내용

`buildMdrProgressIconCells` 함수 내부:

1. `buildSeq` 시그니처에 `initialPrevDone: boolean` 파라미터 추가
2. DD는 기존대로 `true`(SD 완료 간주)로 호출
3. DD 결과에서 DD100의 `state === "done"` 여부를 계산
4. CD는 `initialPrevDone = (DD100 done 여부)`로 호출

```ts
const buildSeq = (stage, pcts, initialPrevDone) => {
  let prevDone = initialPrevDone;
  return pcts.map(...);
};

const dd = buildSeq("DD", DD_PIP_PCTS, true);
const dd100Done = dd[dd.length - 1]?.state === "done";
const cd = buildSeq("CD", CD_PIP_PCTS, dd100Done);
```

### 결과 동작

| 시나리오 | CD30 상태 (수정 전) | CD30 상태 (수정 후) |
|---|---|---|
| DD 전혀 시작 안함, CD plan_date 미래 | WIP ❌ | planned ✅ |
| DD 진행 중(DD100 미완료), CD plan_date 미래 | WIP ❌ | planned ✅ |
| DD100 완료, CD30 미시작, plan_date 미래 | WIP | WIP ✅ |
| CD30 plan_date 경과, 미완료 | delay | delay (변동 없음) |
| CD30 is_done=true | done | done (변동 없음) |

### 검증
- `/design` → 임의 시트에서 DD 미완료 도면의 Progress 아이콘 확인 (Playwright 스크린샷)
- 기존 done/delay 케이스가 그대로 유지되는지 시각 비교

### 비변경 사항
- DD 그룹 시작 로직(SD→DD30)은 그대로 유지 (요청에 없음)
- 컬럼/그리드/요약표 로직 변동 없음
