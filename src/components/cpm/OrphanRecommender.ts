// Orphan → 신규 Activity 추천 점수 계산
// 100점: BLDG + WBS L2 + Name 완전 일치 (자동 적용 대상)
// 80점:  BLDG + Name 일치
// 60점:  Name 일치
// 40점:  BLDG + Name Levenshtein <= 3
// 0점:   매칭 없음

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

function getBldg(cf: Record<string, string> | null | undefined): string {
  const c = cf || {};
  return (c.BLDG || c.Text2 || c["텍스트2"] || "").trim();
}

function getWbsL2(wbs: string | null | undefined): string {
  if (!wbs) return "";
  const parts = wbs.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] || "";
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export function recommendFor(orphan: OrphanLike, candidates: CandidateActivity[]): Recommendation {
  const oBldg = getBldg(orphan.custom_fields);
  const oWbsL2 = getWbsL2(orphan.wbs_full);
  const oName = (orphan.name || "").trim();

  let best: Recommendation = { candidate: null, score: 0 };

  for (const c of candidates) {
    const cBldg = getBldg(c.custom_fields);
    const cWbsL2 = getWbsL2(c.wbs_full);
    const cName = (c.name || "").trim();

    let score = 0;
    if (oBldg && cBldg === oBldg && cWbsL2 === oWbsL2 && cName === oName) {
      score = 100;
    } else if (oBldg && cBldg === oBldg && cName === oName) {
      score = 80;
    } else if (cName === oName) {
      score = 60;
    } else if (oBldg && cBldg === oBldg && levenshtein(cName, oName) <= 3) {
      score = 40;
    }

    if (score > best.score) {
      best = { candidate: c, score };
      if (score === 100) break;
    }
  }

  return best;
}
