/**
 * 단계 흐름 제약 (SD → DD → CD → IFR/IFA → IFC).
 * 선행 셀이 100% 완료(isDone=true)되지 않은 경우 후행 셀의 isDone 을 false 로 강제.
 *
 * 적용 순서: stage(SD < DD < CD) × pct 오름차순 × subIdx 오름차순.
 * STR DD 의 Information(30) → STR Analysis(60) → Drawings(100) 도 자연스럽게 같은 규칙으로 처리됨.
 *
 * IFR/IFA, IFC 는 본 함수에서 다루지 않음(메타 날짜로만 보관, 패널에서 경고 배지로 표시).
 */
import type { MdrStage } from "./parser";

type Cell = { stage: MdrStage; pct: number; subIdx: number; incrementPct: number };
type Prog = { stage: MdrStage; pct: number; subIdx?: number | null; isDone: boolean };

const STAGE_ORDER: Record<MdrStage, number> = { SD: 0, DD: 1, CD: 2 };

export function enforceSequential<P extends Prog>(progress: P[], cells: Cell[]): P[] {
  if (!cells.length) return progress;
  const ordered = [...cells].sort((a, b) => {
    if (STAGE_ORDER[a.stage] !== STAGE_ORDER[b.stage]) return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.subIdx - b.subIdx;
  });
  const progMap = new Map<string, P>();
  for (const p of progress) progMap.set(`${p.stage}|${p.pct}|${p.subIdx ?? 0}`, p);

  const result: P[] = [];
  let prevDone = true;
  for (const c of ordered) {
    const key = `${c.stage}|${c.pct}|${c.subIdx}`;
    const original = progMap.get(key);
    const rawDone = original ? !!original.isDone : false;
    const effective = prevDone && rawDone;
    if (original) {
      result.push({ ...original, isDone: effective });
    } else {
      // 셀 정의는 있는데 progress 행이 없는 경우 미완료로 추가
      result.push({ stage: c.stage, pct: c.pct, subIdx: c.subIdx, isDone: false } as P);
    }
    prevDone = effective;
  }
  return result;
}
