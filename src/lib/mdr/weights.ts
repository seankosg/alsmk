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

/** FAFP(소방) 전용 Stage WF — 소방은 SD 없음, DD/CD 50:50 (엑셀 Notes 2.1) */
export const FAFP_STAGE_WF: Record<StageCode, number> = {
  SD: 0,
  DD: 0.5,
  CD: 0.5,
};

/**
 * Team 가중치 — Arch + Civil + STR + Mech + Elec = 1.0
 * (DB에는 discipline=ARCH/CIVIL/STR/MECH/ELEC row로 저장 — 기존 mdr_weights 스키마 호환)
 */
export const TEAMS = ["ARCH", "CIVIL", "STR", "MECH", "ELEC"] as const;
export type TeamCode = (typeof TEAMS)[number];

export const TEAM_LABEL: Record<TeamCode, string> = {
  ARCH: "Arch",
  CIVIL: "Civil",
  STR: "STR",
  MECH: "Mech",
  ELEC: "Elec",
};

export const DEFAULT_TEAM_WF: Record<TeamCode, number> = {
  ARCH: 0.45,
  CIVIL: 0,
  STR: 0.25,
  MECH: 0.19,
  ELEC: 0.11,
};

/** Backward-compat alias — Team WF는 기존 discipline row를 그대로 사용 */
export const DEFAULT_DISCIPLINE_WF: Record<string, number> = { ...DEFAULT_TEAM_WF };

/** Discipline → Team 매핑 */
export const TEAM_OF_DISCIPLINE: Record<string, TeamCode> = {
  ARCH: "ARCH",
  CIVIL: "CIVIL",
  STR: "STR",
  MECH: "MECH",
  FP: "MECH",
  HV: "MECH",
  ELEC: "ELEC",
  TEL: "ELEC",
  FA: "ELEC",
};

/** Team별 Discipline 표시 순서 */
export const DISCIPLINES_BY_TEAM: Record<TeamCode, string[]> = {
  ARCH: ["ARCH"],
  CIVIL: ["CIVIL"],
  STR: ["STR"],
  MECH: ["MECH", "FP", "HV"],
  ELEC: ["ELEC", "TEL", "FA"],
};

export function teamOfDiscipline(disc: string): TeamCode | null {
  return TEAM_OF_DISCIPLINE[disc] ?? null;
}

/** Building 가중치 (공사비 비중) — 합 1.0. GEN(General)은 키 없음 → 합산 제외(플랜트 업역). */
export const DEFAULT_BUILDING_WF: Record<string, number> = {
  "SMP&CCM": 0.288,
  "HSM": 0.132,
  "CRM": 0.559,
  "MAIN_OFFICE": 0.021,
};

export interface MdrWfBundle {
  stage: Record<StageCode, number>;
  /** Team WF — key는 TeamCode (ARCH/CIVIL/STR/MECH/ELEC). discipline 필드명은 DB 스키마 호환을 위해 유지. */
  discipline: Record<string, number>;
  building: Record<string, number>;
}

/**
 * mdr_weights 테이블에서 WF 로드 (is_reference_only=false 만).
 * 행이 없으면 기본 상수 그대로 반환.
 */
export async function loadMdrWeights(): Promise<MdrWfBundle> {
  const bundle: MdrWfBundle = {
    stage: { ...DEFAULT_STAGE_WF },
    discipline: { ...DEFAULT_TEAM_WF },
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
  if (up === "TEL" || up.startsWith("TEL")) return "TEL";
  if (up === "HV" || up.startsWith("HV")) return "HV";
  if (up === "CV" || up.startsWith("CIVIL")) return "CIVIL";
  // FP / FA: 신규 세부 코드
  if (up === "FP" || up.startsWith("FP")) return "FP";
  if (up === "FA" || up.startsWith("FA")) return "FA";
  // 레거시 FAFP/FIRE → Mech의 FP로 폴백
  if (up === "FF" || up.startsWith("FAFP") || up.startsWith("FIRE")) return "FP";
  return up;
}
