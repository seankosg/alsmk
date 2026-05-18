// Orphan → 신규 Activity 추천 점수
// 100점: BLDG + WBS_L2 + Name 완전 일치 (자동 적용)
//  95점: BLDG + Name 일치 (WBS 변경)
//  80점: WBS_L2 + Name 일치 (BLDG 누락/변경)
//  60점: Name 일치
//  50점: BLDG + WBS_L2 일치 + Name 접두/접미 포함 (분할 추정)
//   0점: 매칭 없음

export interface OrphanLike {
  id: string;
  name: string;
  wbs_full: string | null;
  custom_fields?: Record<string, string> | null;
}

export interface CandidateActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  custom_fields?: Record<string, string> | null;
}

export interface Recommendation {
  candidate: CandidateActivity | null;
  score: number;
}

export interface ScoredCandidate {
  candidate: CandidateActivity;
  score: number;
}

function getBldg(cf: Record<string, string> | null | undefined): string {
  const c = cf || {};
  return (c.BLDG || c.Text2 || c["텍스트2"] || "").trim();
}

function getWbsL2(wbs: string | null | undefined): string {
  if (!wbs) return "";
  const parts = wbs.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] || "";
}

function scorePair(orphan: OrphanLike, c: CandidateActivity): number {
  const oBldg = getBldg(orphan.custom_fields);
  const oWbsL2 = getWbsL2(orphan.wbs_full);
  const oName = (orphan.name || "").trim();
  const cBldg = getBldg(c.custom_fields);
  const cWbsL2 = getWbsL2(c.wbs_full);
  const cName = (c.name || "").trim();

  if (oBldg && cBldg === oBldg && cWbsL2 === oWbsL2 && cName === oName) return 100;
  if (oBldg && cBldg === oBldg && cName === oName) return 95;
  if (oWbsL2 && cWbsL2 === oWbsL2 && cName === oName) return 80;
  if (cName === oName) return 60;
  if (
    oBldg && cBldg === oBldg && oWbsL2 && cWbsL2 === oWbsL2 &&
    oName && cName &&
    (cName.startsWith(oName) || cName.endsWith(oName) ||
      oName.startsWith(cName) || oName.endsWith(cName))
  ) return 50;
  return 0;
}

export function recommendFor(orphan: OrphanLike, candidates: CandidateActivity[]): Recommendation {
  let best: Recommendation = { candidate: null, score: 0 };
  for (const c of candidates) {
    const score = scorePair(orphan, c);
    if (score > best.score) {
      best = { candidate: c, score };
      if (score === 100) break;
    }
  }
  return best;
}

export function scoreCandidates(
  orphan: OrphanLike,
  candidates: CandidateActivity[],
  topK = 3,
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const score = scorePair(orphan, c);
    if (score > 0) scored.push({ candidate: c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
