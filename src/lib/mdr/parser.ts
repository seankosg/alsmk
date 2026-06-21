import * as XLSX from "xlsx";
import { MDR_REIMPORT_MARKER, detectColumnKey } from "./columnMap";

export type MdrStage = "SD" | "DD" | "CD";

export interface MdrMilestoneDef {
  stage: MdrStage;
  pct: number;          // 30, 60, 90, 100
  incrementPct: number; // 헤더 2행: 증분
  planDate?: string;    // ISO YYYY-MM-DD
}

export interface MdrParsedRow {
  sourceNo: string;             // 원본 A열
  itemNo: string;               // ${BUILDING}-${sourceNo}
  building: string;
  discipline: string;
  jobNo?: string;
  areaCode?: string;
  functionCode?: string;
  serialNo?: string;
  activityGroup?: string;
  drawingTitle?: string;
  planFinish?: string;          // 마일스톤 중 가장 늦은 plan_date
  outOfScope: boolean;
  sourceSheet: string;
  milestones: MdrMilestoneDef[];
  progress: { stage: MdrStage; pct: number; isDone: boolean }[];
}

export interface MdrParsedSheet {
  sheetName: string;
  discipline: string;
  rows: MdrParsedRow[];
  milestoneOrder: { stage: MdrStage; pct: number }[];
  skipped?: boolean;
  skipReason?: string;
}

export interface MdrParseResult {
  filename: string;
  building: string;
  isSummary: boolean;
  isReimport: boolean;
  sheets: MdrParsedSheet[];
  rawWorkbookBlob: ArrayBuffer;
}

const SKIP_SHEETS = new Set(["MH&DWG", "Sheet1", "Sheet3", "MH& DWG", "MASTER"]);
const MILESTONE_RE = /(SD|DD|CD)\s*(\d{1,3})\s*%/i;

/**
 * 파일명에서 건물 코드 추출. 다단어 건물명은 공백을 `_`로 치환해 보존.
 *   - "01_GEN_MDR progress"            → "GEN"
 *   - "02_SMP&CCM_MDR PROGRESS"        → "SMP&CCM"
 *   - "05_MAIN OFFICE_MDR PROGRESS"    → "MAIN_OFFICE"
 * 폴백: 두 번째 `_` 토큰 → 괄호 안 → 마지막 토큰.
 */
const toBuildingCode = (s: string): string =>
  s.trim().replace(/\s+/g, "_").toUpperCase();

export function extractBuildingFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  // 1) {NN}_..._MDR 패턴 (다단어 건물명 보존)
  const m = base.match(/^\d+[_\s\-]+(.+?)[_\s\-]+MDR\b/i);
  if (m) {
    const captured = m[1].trim();
    if (captured) return toBuildingCode(captured);
  }
  // 2) 두 번째 `_` 토큰 (다단어 보존)
  const parts = base.split(/_+/);
  if (parts.length >= 2 && parts[1].trim()) {
    return toBuildingCode(parts[1]);
  }
  // 3) 괄호 안
  const paren = base.match(/\(([^)]+)\)/);
  if (paren) return toBuildingCode(paren[1]);
  // 4) 마지막 토큰
  const tail = base.split(/[_\-\s]+/).pop() ?? base;
  return tail.toUpperCase();
}

export function isSummaryFilename(filename: string): boolean {
  return /^00[_\s-]|summary/i.test(filename);
}

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return "";
  return String(cell.w ?? cell.v ?? "").trim();
}

function cellRaw(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })];
}

/** 헤더 시작 행(`NO.` 셀)을 찾는다. 반환: { headerRow, noCol } */
function findHeaderAnchor(ws: XLSX.WorkSheet): { headerRow: number; noCol: number } | null {
  const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
  if (!range) return null;
  for (let r = range.s.r; r <= Math.min(range.s.r + 30, range.e.r); r++) {
    for (let c = range.s.c; c <= Math.min(range.s.c + 8, range.e.c); c++) {
      const v = cellStr(ws, r, c).toUpperCase().replace(/\s+/g, "");
      if (v === "NO." || v === "NO") return { headerRow: r, noCol: c };
    }
  }
  return null;
}

function parseDate(cell: XLSX.CellObject | undefined): string | undefined {
  if (!cell) return undefined;
  if (typeof cell.v === "number") {
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (!d) return undefined;
    const iso = `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return iso;
  }
  if (typeof cell.v === "string") {
    const t = cell.v.trim();
    if (!t) return undefined;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function isYes(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "y" || t === "yes" || t === "o" || t === "✓" || t === "1";
}

function parseSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  building: string,
): MdrParsedSheet {
  const discipline = sheetName.toUpperCase().split(/[_\-\s]/)[0];
  const anchor = findHeaderAnchor(ws);
  if (!anchor) {
    return { sheetName, discipline, rows: [], milestoneOrder: [], skipped: true, skipReason: "헤더(NO.) 셀을 찾지 못함" };
  }
  const { headerRow, noCol } = anchor;
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  const maxCol = range.e.c;

  // 마일스톤 라벨 행 자동 탐지: headerRow ~ headerRow+2 중 (SD|DD|CD)\d+% 매칭이 가장 많은 행
  let milestoneLabelRow = headerRow;
  let bestHits = -1;
  for (let r = headerRow; r <= headerRow + 2; r++) {
    let hits = 0;
    for (let c = noCol; c <= maxCol; c++) {
      if (MILESTONE_RE.test(cellStr(ws, r, c))) hits++;
    }
    if (hits > bestHits) { bestHits = hits; milestoneLabelRow = r; }
  }
  const incrementRow = milestoneLabelRow + 1;
  const planDateRow = milestoneLabelRow + 2;

  // 1) 식별 컬럼 + 마일스톤 그룹(서브컬럼 묶음) 매핑
  const headers: { col: number; key: ReturnType<typeof detectColumnKey> | null; text: string }[] = [];
  interface MilestoneGroup {
    stage: MdrStage;
    pct: number;
    cols: number[];           // 그룹에 속한 서브컬럼들
    incrementPct: number;     // 서브컬럼 증분 합
    planDate?: string;        // 서브컬럼 중 가장 늦은 plan_date
  }
  const milestoneGroups: MilestoneGroup[] = [];

  // 병합셀(merge)로 라벨이 가로로 확장된 경우 시작셀(왼쪽-위)에만 라벨이 존재.
  // headerRow 에 식별성 헤더 텍스트가 있는 컬럼은 마일스톤 그룹의 경계로 사용.
  const isIdentHeader = (c: number): boolean => {
    const t = cellStr(ws, headerRow, c);
    if (!t) return false;
    // 식별 헤더만 경계로 인정 (DISCIPLINE/JOB/Area Code/Function Code/Serial/Activity Group/Drawing Title 등)
    return detectColumnKey(t) !== null || /discipline|job|area|function|serial|activity|drawing|title|remark|status|note/i.test(t);
  };

  let c = noCol;
  while (c <= maxCol) {
    const labelText = cellStr(ws, milestoneLabelRow, c);
    const m = labelText.match(MILESTONE_RE);
    if (m) {
      const stage = m[1].toUpperCase() as MdrStage;
      const pct = parseInt(m[2], 10);
      const start = c;
      let end = c;
      // 다음 라벨 / 식별 헤더 직전까지 동일 그룹
      for (let k = c + 1; k <= maxCol; k++) {
        const nextLabel = cellStr(ws, milestoneLabelRow, k);
        if (nextLabel && MILESTONE_RE.test(nextLabel)) break;
        if (isIdentHeader(k)) break;
        end = k;
      }
      const cols: number[] = [];
      let incrementPct = 0;
      let planDate: string | undefined;
      for (let x = start; x <= end; x++) {
        cols.push(x);
        const incRaw = cellStr(ws, incrementRow, x).replace("%", "").trim();
        const v = parseFloat(incRaw);
        if (!isNaN(v)) incrementPct += v;
        const pd = parseDate(cellRaw(ws, planDateRow, x));
        if (pd && (!planDate || pd > planDate)) planDate = pd;
      }
      milestoneGroups.push({ stage, pct, cols, incrementPct, planDate });
      c = end + 1;
    } else {
      const headerText = cellStr(ws, headerRow, c);
      if (headerText) headers.push({ col: c, key: detectColumnKey(headerText), text: headerText });
      c++;
    }
  }

  // 행 진행도 계산용으로 호환 형태 유지
  const milestoneCols = milestoneGroups.map((g) => ({
    col: g.cols[0],
    stage: g.stage,
    pct: g.pct,
    incrementPct: g.incrementPct,
    planDate: g.planDate,
    cols: g.cols,
  }));

  // planDateRow에 날짜가 하나라도 있으면 데이터는 그 다음 행, 없으면 incrementRow 다음 행에서 시작
  const hasPlanDates = milestoneCols.some((mc) => mc.planDate);
  const dataStartRow = hasPlanDates ? planDateRow + 1 : incrementRow + 1;

  // 2) 데이터 행 파싱
  const rows: MdrParsedRow[] = [];
  for (let r = dataStartRow; r <= range.e.r; r++) {
    const sourceNo = cellStr(ws, r, noCol);
    if (!sourceNo) continue;
    // No 가 숫자/문자 혼합 가능. 빈 줄·합계 행은 패스
    if (/^total|sum|합계/i.test(sourceNo)) continue;

    const findVal = (...candidates: string[]) => {
      for (const cand of candidates) {
        const h = headers.find((x) => x.text.toUpperCase().includes(cand.toUpperCase()));
        if (h) {
          const v = cellStr(ws, r, h.col);
          if (v) return v;
        }
      }
      return undefined;
    };

    const discRaw = findVal("DISCIPLINE") ?? discipline;
    const title = findVal("Drawing Title", "TITLE", "DRAWING");
    if (!title && !sourceNo.match(/\d/)) continue;

    const milestones: MdrMilestoneDef[] = milestoneCols.map((m) => ({
      stage: m.stage,
      pct: m.pct,
      incrementPct: m.incrementPct,
      planDate: m.planDate,
    }));
    const progress = milestoneCols.map((m) => {
      // 그룹 내 어느 서브컬럼이라도 Yes 면 완료로 간주
      const isDone = m.cols.some((x) => isYes(cellStr(ws, r, x)));
      return { stage: m.stage, pct: m.pct, isDone };
    });

    // plan finish: 마일스톤 중 가장 늦은 plan_date
    const lastPlan = milestones
      .map((m) => m.planDate)
      .filter((x): x is string => Boolean(x))
      .sort()
      .pop();

    // out of scope: 모든 마일스톤 increment 0 또는 SD/DD/CD 모두 비활성
    const allZero = milestones.every((m) => m.incrementPct === 0);

    const itemNo = `${building}-${discipline}-${sourceNo}`;
    rows.push({
      sourceNo,
      itemNo,
      building,
      discipline: discRaw,
      jobNo: findVal("JOB"),
      areaCode: findVal("Area Code", "AREA"),
      functionCode: findVal("Function Code", "FUNCTION"),
      serialNo: findVal("Serial"),
      activityGroup: findVal("Activity Group", "GROUP"),
      drawingTitle: title,
      planFinish: lastPlan,
      outOfScope: allZero,
      sourceSheet: sheetName,
      milestones,
      progress,
    });
  }

  return {
    sheetName,
    discipline,
    rows,
    milestoneOrder: milestoneCols.map(({ stage, pct }) => ({ stage, pct })),
  };
}

export async function parseMdrFile(file: File): Promise<MdrParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellStyles: true, cellDates: false, cellNF: true });
  const filename = file.name;
  const isSummary = isSummaryFilename(filename);
  const building = isSummary ? "_SUMMARY_" : extractBuildingFromFilename(filename);
  const isReimport = (wb.Workbook?.Names ?? []).some((n) =>
    n.Name?.includes("ALSMK_MDR_REIMPORT") || n.Ref?.includes(MDR_REIMPORT_MARKER),
  );

  const sheets: MdrParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name.toUpperCase()) || SKIP_SHEETS.has(name)) continue;
    if (/sheet\d+/i.test(name)) continue;
    const ws = wb.Sheets[name];
    if (!ws) continue;
    sheets.push(parseSheet(ws, name, building));
  }

  return { filename, building, isSummary, isReimport, sheets, rawWorkbookBlob: buf };
}
