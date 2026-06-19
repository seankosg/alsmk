/**
 * MDR Export ↔ Import 컬럼 매핑 사전 (단일 출처).
 * Export로 만든 엑셀이 동일하게 Import 가능하도록 헤더 매핑을 보존한다.
 */

export const MDR_REIMPORT_MARKER = "[Format: ALSMK_MDR_REIMPORT_V1]";

export interface MdrColumnDef {
  header: string;
  source: "original_a" | "app_generated" | "original";
  preserveOnReimport?: boolean;
  /** UNIQUE key 매칭에 사용 (재임포트 시 행 식별) */
  key?: boolean;
}

export const MDR_COLUMN_MAP = {
  no:            { header: "No.",            source: "original_a" },
  building:      { header: "Building",       source: "app_generated", preserveOnReimport: true },
  itemNo:        { header: "Item No.",       source: "app_generated", preserveOnReimport: true, key: true },
  discipline:    { header: "DISCIPLINE",     source: "original" },
  jobNo:         { header: "JOB No.",        source: "original" },
  areaCode:      { header: "Area Code",      source: "original" },
  functionCode:  { header: "Function Code",  source: "original" },
  serialNo:      { header: "Serial No.",     source: "original" },
  activityGroup: { header: "Activity Group", source: "original" },
  drawingTitle: { header: "Drawing Title",  source: "original" },
} as const satisfies Record<string, MdrColumnDef>;

export type MdrColumnKey = keyof typeof MDR_COLUMN_MAP;

/** 시트 셀에서 헤더 텍스트로 컬럼 키를 추정 */
export function detectColumnKey(headerText: string): MdrColumnKey | null {
  const norm = headerText.trim().toLowerCase();
  for (const [key, def] of Object.entries(MDR_COLUMN_MAP)) {
    if (def.header.trim().toLowerCase() === norm) return key as MdrColumnKey;
  }
  return null;
}
