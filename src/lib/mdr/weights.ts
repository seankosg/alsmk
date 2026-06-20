/**
 * SUMMARY 진척률 계산에 쓰이는 가중치(Weight Factor) 정의.
 * - 코드 상수 = 폴백 기본값 (SUMMARY 엑셀 260611판 기준)
 * - 실제 값은 mdr_weights 테이블에서 우선 로드, 없으면 상수 사용
 */
import { supabase } from "@/integrations/supabase/client";

export type StageCode = "SD" | "DD" | "CD";

/** Stage 가중치 — SD + DD + CD = 1.0 */
export const DEFAULT_STAGE_WF: Record<StageCode, number> = {
  SD: 0.2,
  DD: 0.4,
  CD: 0.4,
};

/** Discipline 가중치 — ARCH + STR + MECH + FAFP + ELEC + CIVIL = 1.0 (CIVIL은 0) */
export const DEFAULT_DISCIPLINE_WF: Record<string, number> = {
  ARCH: 0.45,
  STR: 0.25,
  MECH: 0.09,
  FAFP: 0.10,
  ELEC: 0.11,
  CIVIL: 0,
};

/** Building 가중치 (공사비 비중) — 합 1.0. GEN(General)은 키 없음 → 합산 제외(플랜트 업역). */
export const DEFAULT_BUILDING_WF: Record<string, number> = {
  "SMP&CCM": 0.288,
  "HSM": 0.132,
  "CRM": 0.559,
  "MAIN_OFFICE": 0.021,
};

export interface MdrWfBundle {
  stage: Record<StageCode, number>;
  discipline: Record<string, number>;
  building: Record<string, number>;
}

/**
 * mdr_weights 테이블에서 WF 로드 (is_reference_only=false 만).
 * 행이 없으면 기본 상수 그대로 반환.
 *
 * 행 구분:
 *  - Stage WF      → building_code = null, discipline = null, stage IN ('SD','DD','CD')
 *  - Discipline WF → building_code = null, discipline = '...', stage = null
 *  - Building WF   → building_code = '...', discipline = null, stage = null
 */
export async function loadMdrWeights(): Promise<MdrWfBundle> {
  const bundle: MdrWfBundle = {
    stage: { ...DEFAULT_STAGE_WF },
    discipline: { ...DEFAULT_DISCIPLINE_WF },
    building: { ...DEFAULT_BUILDING_WF },
  };

  const { data, error } = await supabase
    .from("mdr_weights" as never)
    .select("building_code, discipline, stage, weight")
    .eq("is_reference_only", false);

  if (error || !data) return bundle;

  for (const r of data as any[]) {
    const w = Number(r.weight);
    if (!isFinite(w)) continue;
    if (r.building_code == null && r.discipline == null && r.stage) {
      bundle.stage[r.stage as StageCode] = w;
    } else if (r.building_code == null && r.discipline && r.stage == null) {
      bundle.discipline[String(r.discipline).toUpperCase()] = w;
    } else if (r.building_code && r.discipline == null && r.stage == null) {
      bundle.building[String(r.building_code).toUpperCase()] = w;
    }
  }
  return bundle;
}

/** Discipline 코드 정규화 — raw data의 discipline 컬럼을 표준 코드로 매핑 */
export function normalizeDiscipline(raw: string | null | undefined): string {
  if (!raw) return "ETC";
  const up = raw.toUpperCase().trim();
  if (up === "AR" || up.startsWith("ARCH")) return "ARCH";
  if (up === "ST" || up.startsWith("STR")) return "STR";
  if (up === "ME" || up.startsWith("MECH")) return "MECH";
  if (up === "EL" || up.startsWith("ELEC")) return "ELEC";
  if (up === "CV" || up.startsWith("CIVIL")) return "CIVIL";
  if (up === "FF" || up.startsWith("FAFP") || up.startsWith("FIRE")) return "FAFP";
  return up;
}
