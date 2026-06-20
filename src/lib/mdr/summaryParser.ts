import * as XLSX from "xlsx";

export interface SummaryWeightRow {
  discipline: string;       // PR, SF, MR, MS, CV, SS, AR, HV, PI, EL, TE, IC, GIS
  disciplineName: string;   // Process, Safety & Fire Fighting, ...
  manHours: number;         // M/H
  drawingCount: number;     // DWG수
  pct: number;              // 0~1 (전체 대비 %)
}

export interface SummaryMatrixRow {
  blockCode: string;        // GEN, SMP&CCM, HSM, CRM, MAIN_OFFICE
  discipline: string;       // ARCH, STR, MECH, ELEC, CIVIL, FAFP
  sdPlan: number;
  sdActual: number;
  ddPlan: number;
  ddActual: number;
  cdPlan: number;
  cdActual: number;
}

export interface SummaryParseResult {
  filename: string;
  weights: SummaryWeightRow[];
  matrix: SummaryMatrixRow[];
}

const BLOCK_NORMALIZE: Record<string, string> = {
  "GENERAL": "GEN",
  "GEN": "GEN",
  "SMP&CCM": "SMP&CCM",
  "SMP & CCM": "SMP&CCM",
  "HSM": "HSM",
  "CRM": "CRM",
  "MAIN OFFICE": "MAIN_OFFICE",
  "MAIN_OFFICE": "MAIN_OFFICE",
};

function cell(ws: XLSX.WorkSheet, r: number, c: number): any {
  const a = ws[XLSX.utils.encode_cell({ r, c })];
  return a?.v;
}
function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string {
  const v = cell(ws, r, c);
  return v == null ? "" : String(v).trim();
}
function cellNum(ws: XLSX.WorkSheet, r: number, c: number): number {
  const v = cell(ws, r, c);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[,%]/g, ""));
    return isFinite(n) ? n : 0;
  }
  return 0;
}

/** MH&DWG 시트 파싱: 컬럼 E=code, F=M/H, G=%, H=DWG수, 행 5~30 */
function parseWeights(ws: XLSX.WorkSheet): SummaryWeightRow[] {
  if (!ws["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const out: SummaryWeightRow[] = [];
  for (let r = 4; r <= Math.min(range.e.r, 50); r++) {
    const code = cellStr(ws, r, 4); // E
    if (!code || /^-/.test(code)) continue; // 빈 행 또는 sub-row(- Fire Fighting 등)
    if (!/^[A-Z]{2,4}$/i.test(code)) continue;
    const name = cellStr(ws, r, 1) || cellStr(ws, r, 2) || code; // B 또는 C
    const mh = cellNum(ws, r, 5);
    const pct = cellNum(ws, r, 6);
    const dwg = cellNum(ws, r, 7);
    if (mh === 0 && dwg === 0) continue;
    out.push({
      discipline: code.toUpperCase(),
      disciplineName: name,
      manHours: mh,
      drawingCount: dwg,
      pct: pct,
    });
  }
  return out;
}

/** Weekly progress 시트 파싱: B=Block, C=Disc, D=SD Plan, E=SD Actual, F=DD Plan, G=DD Actual, H=CD Plan, I=CD Actual */
function parseMatrix(ws: XLSX.WorkSheet): SummaryMatrixRow[] {
  if (!ws["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const out: SummaryMatrixRow[] = [];
  let currentBlock = "";
  for (let r = 7; r <= Math.min(range.e.r, 80); r++) {
    const blockRaw = cellStr(ws, r, 1).replace(/\s+/g, " ").replace(/\n/g, " ").trim();
    const disc = cellStr(ws, r, 2).toUpperCase();
    if (blockRaw) {
      const norm = BLOCK_NORMALIZE[blockRaw.toUpperCase()] ?? blockRaw.toUpperCase().replace(/\s+/g, "_");
      if (norm === "TOTAL") { currentBlock = ""; continue; }
      currentBlock = norm;
    }
    if (!disc || disc === "SUB-TOTAL" || disc === "TOTAL") continue;
    if (!currentBlock) continue;
    const sdPlan = cellNum(ws, r, 3);
    const sdActual = cellNum(ws, r, 4);
    const ddPlan = cellNum(ws, r, 5);
    const ddActual = cellNum(ws, r, 6);
    const cdPlan = cellNum(ws, r, 7);
    const cdActual = cellNum(ws, r, 8);
    if (sdPlan + sdActual + ddPlan + ddActual + cdPlan + cdActual === 0) continue;
    out.push({
      blockCode: currentBlock,
      discipline: disc,
      sdPlan, sdActual, ddPlan, ddActual, cdPlan, cdActual,
    });
  }
  return out;
}

export async function parseSummaryFile(file: File): Promise<SummaryParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const weightsSheet = wb.Sheets["MH&DWG"] ?? wb.Sheets["MH& DWG"];
  const weeklySheet = wb.Sheets["Weekly progress"] ?? wb.Sheets["Weekly Progress"];
  return {
    filename: file.name,
    weights: weightsSheet ? parseWeights(weightsSheet) : [],
    matrix: weeklySheet ? parseMatrix(weeklySheet) : [],
  };
}
