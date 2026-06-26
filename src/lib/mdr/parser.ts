import * as XLSX from "xlsx";
import { MDR_REIMPORT_MARKER, detectColumnKey } from "./columnMap";

export type MdrStage = "SD" | "DD" | "CD";

/** 마일스톤 그룹 내 단일 서브컬럼(엑셀 셀) 정의 */
export interface MdrMilestoneCellDef {
  subIdx: number;        // 그룹 내 0-based 인덱스
  incrementPct: number;  // 셀 단위 증분 (헤더 2행의 그 셀)
  planDate?: string;     // 셀 단위 plan_date (없으면 그룹 plan_date 사용)
  label?: string;        // STR DD 처럼 row 5 라벨이 있는 경우 보존 (Information / STR Analysis / Drawings)
}

export interface MdrMilestoneDef {
  stage: MdrStage;
  pct: number;          // 30, 60, 90, 100
  incrementPct: number; // 그룹 합 (mdr_milestones.increment_pct 호환)
  planDate?: string;    // ISO YYYY-MM-DD — 그룹의 가장 늦은 plan_date
  label?: string;       // STR DD 처럼 row 5 라벨이 있는 경우 (Information / STR Analysis / Drawings)
  cells: MdrMilestoneCellDef[]; // 그룹 내 모든 서브컬럼
}

/** 라벨이 없는 N개 그룹을 cumulative pct 로 매핑 */
const STAGE_UNLABELED_PCTS: Record<number, number[]> = {
  1: [100],
  2: [50, 100],
  3: [30, 60, 100],
  4: [30, 60, 90, 100],
};


export interface MdrParsedRow {
  sourceNo: string;             // 원본 A열
  itemNo: string;               // ${BUILDING}-${sourceNo} (보조 식별자)
  building: string;
  discipline: string;
  plantId?: string;
  pbs?: string;
  fbs?: string;
  serNo?: string;
  rev: string;                  // 리비전 (없으면 "A", 알파벳 오름차순: A→B→…→Z→AA→AB)
  /** 자연키. 누락 토큰은 빈 문자열로 join. 4개 모두 누락이면 fallback 적용. */
  docBase: string;
  docNo: string;                // docBase + "-" + rev (표시용)
  /** 4개 토큰 중 어느 것이 누락(빈값/TBD)이었는지. UI 하이라이트용. */
  missingTokens: { plantId: boolean; pbs: boolean; fbs: boolean; serNo: boolean };
  activityGroup?: string;
  drawingTitle?: string;
  planFinish?: string;          // 마일스톤 중 가장 늦은 plan_date
  outOfScope: boolean;
  /** SD/DD/CD 헤더 컬럼의 "O" 표시 여부. 도면이 해당 단계에서 필요한지 결정. */
  inScope: { sd: boolean; dd: boolean; cd: boolean };
  /** 엑셀 부가 메타 (UI에 노출, 진척 계산에는 미사용) */
  confirmedBy?: string;
  ifrStartDate?: string;
  ifrIssueDate?: string;
  ifcStartDate?: string;
  ifcIssueDate?: string;
  documentClass?: string;
  docClassCode?: string;
  stagePlanSd?: string;
  stagePlanDd?: string;
  stagePlanCd?: string;
  sourceSheet: string;
  rawRowNo: number;
  milestones: MdrMilestoneDef[];
  /** 셀 단위 진행 — 그룹 OR 아닌 서브컬럼별 Y/N */
  progress: { stage: MdrStage; pct: number; subIdx: number; isDone: boolean }[];
  /** 원본 엑셀 행의 셀 값 (헤더 → 값). 동일 양식 재내보내기에 사용. */
  rawRowCells: Record<string, string | number | boolean | null>;
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
  const m = base.match(/^\d+[_\s\-]+(.+)[_\s\-]+MDR(?=[_\s\-]|$)/i);
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

/**
 * 시트명에서 discipline 추출.
 * - 괄호 안 내용 제거: "MDR (Drawing)_FA,FP" → "MDR _FA,FP"
 * - MDR/DRAWING/DWG/PROGRESS 등 노이즈 토큰 제외
 * - 분리자 `_`, `-`, 공백 (쉼표 보존)
 */
function extractDisciplineFromSheetName(sheetName: string): string {
  const NOISE = new Set(["MDR", "DRAWING", "DWG", "PROGRESS", "DRAWINGS"]);
  const cleaned = sheetName.replace(/\([^)]*\)/g, " ").toUpperCase();
  const tokens = cleaned.split(/[_\-\s]+/).map((t) => t.trim()).filter(Boolean);
  const meaningful = tokens.find((t) => !NOISE.has(t));
  return meaningful ?? tokens[0] ?? sheetName.toUpperCase();
}

function parseSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  building: string,
): MdrParsedSheet {
  let discipline = extractDisciplineFromSheetName(sheetName);
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
    label?: string;
    cols: number[];           // 그룹에 속한 서브컬럼들
    incrementPct: number;     // 서브컬럼 증분 합
    planDate?: string;        // 서브컬럼 중 가장 늦은 plan_date
    cells: { subIdx: number; col: number; incrementPct: number; planDate?: string; label?: string }[];
  }
  const milestoneGroups: MilestoneGroup[] = [];

  // 식별 헤더 텍스트: row 4 (headerRow) ∪ row 5 (milestoneLabelRow) 결합.
  // 일부 파일(SMP&CCM 등)은 row 4 "DWG. NO" 가로병합 + row 5 서브헤더(PLANT ID/PBS/FBS/SER.NO./REV.NO.) 구조.
  const headerTextAt = (col: number): string => {
    const t5 = milestoneLabelRow !== headerRow ? cellStr(ws, milestoneLabelRow, col) : "";
    if (t5 && !MILESTONE_RE.test(t5)) return t5;
    const t4 = cellStr(ws, headerRow, col);
    if (t4) return t4;
    return t5;
  };

  const isIdentHeader = (col: number): boolean => {
    const t = headerTextAt(col);
    if (!t) return false;
    if (MILESTONE_RE.test(t)) return false;
    return detectColumnKey(t) !== null || /discipline|plant|pbs|fbs|ser\.?\s*no|job|area|function|serial|activity|drawing|title|remark|status|note|confirmed|weight|plan\s*date|document\s*class|문서분류|부서별|rev/i.test(t);
  };

  // row 4 에서 단계 영역(SD/DD/CD) 시작 컬럼 탐지.
  // - "Schematic Design" / "Design Development" / "Construction Documentation" 텍스트로 매핑.
  // - 또는 단일 토큰 "SD"/"DD"/"CD" 가 마일스톤 라벨 영역의 첫 컬럼에 등장하는 경우도 포함.
  const STAGE_ROW4_RE = /(schematic\s*design|design\s*development|construction\s*documentation)/i;
  const stageRegions: { stage: MdrStage; start: number; end: number }[] = [];
  {
    const rawMarks: { stage: MdrStage; col: number }[] = [];
    for (let cc = noCol; cc <= maxCol; cc++) {
      const t4 = cellStr(ws, headerRow, cc).trim();
      if (!t4) continue;
      const mm = t4.match(STAGE_ROW4_RE);
      if (mm) {
        const w = mm[1].toLowerCase();
        const stage: MdrStage = w.startsWith("sch") ? "SD" : w.startsWith("des") ? "DD" : "CD";
        rawMarks.push({ stage, col: cc });
      }
    }
    rawMarks.sort((a, b) => a.col - b.col);
    for (let i = 0; i < rawMarks.length; i++) {
      const start = rawMarks[i].col;
      const end = i + 1 < rawMarks.length ? rawMarks[i + 1].col - 1 : maxCol;
      stageRegions.push({ stage: rawMarks[i].stage, start, end });
    }
  }
  const stageAt = (col: number): MdrStage | null => {
    for (const r of stageRegions) if (col >= r.start && col <= r.end) return r.stage;
    return null;
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
      for (let k = c + 1; k <= maxCol; k++) {
        const nextLabel = cellStr(ws, milestoneLabelRow, k);
        if (nextLabel && MILESTONE_RE.test(nextLabel)) break;
        if (isIdentHeader(k)) break;
        // row 4 의 다음 단계 헤더(예: "Design Development" / "Construction Documentation")
        // 를 만나면 현재 마일스톤 그룹을 끊는다. (STR SD100% 가 DD region 을 잠식하던 버그 방지)
        const r4 = cellStr(ws, headerRow, k);
        if (r4 && STAGE_ROW4_RE.test(r4)) break;
        end = k;
      }
      const cols: number[] = [];
      const cells: { subIdx: number; col: number; incrementPct: number; planDate?: string; label?: string }[] = [];
      let incrementPct = 0;
      let planDate: string | undefined;
      let subIdx = 0;
      for (let x = start; x <= end; x++) {
        cols.push(x);
        const incRaw = cellStr(ws, incrementRow, x).replace("%", "").trim();
        const v = parseFloat(incRaw);
        const cellInc = !isNaN(v) ? v : 0;
        if (cellInc > 0) incrementPct += cellInc;
        const pd = parseDate(cellRaw(ws, planDateRow, x));
        if (pd && (!planDate || pd > planDate)) planDate = pd;
        if (cellInc > 0) {
          cells.push({ subIdx, col: x, incrementPct: cellInc, planDate: pd });
          subIdx++;
        }
      }
      milestoneGroups.push({ stage, pct, cols, incrementPct, planDate, cells });
      c = end + 1;
    } else {
      const headerText = headerTextAt(c);
      if (headerText && !MILESTONE_RE.test(headerText)) {
        headers.push({ col: c, key: detectColumnKey(headerText), text: headerText });
      }
      c++;
    }
  }

  // ── STR DD 스타일 보강 ─────────────────────────────────────────────────────
  // row 4 가 "Design Development" / "Schematic Design" / "Construction Documentation"
  // 으로 표시된 단계 영역인데 그 안에 MILESTONE_RE 로 잡힌 그룹이 0개인 경우,
  // row 5 의 라벨(예: Information / STR Analysis / Drawings)로 그룹화.
  // 단, "Progress" 라벨은 제외. cumulative pct 는 STAGE_UNLABELED_PCTS 매핑.
  for (const region of stageRegions) {
    const insideMs = milestoneGroups.filter((g) => g.cols.some((x) => x >= region.start && x <= region.end));
    if (insideMs.length > 0) continue;
    // row 5 라벨 토큰 추출
    const labelCols: { label: string; start: number; end: number; cols: number[] }[] = [];
    let curLabel: string | null = null;
    let curStart = -1;
    let curCols: number[] = [];
    const isProgressLabel = (s: string) => /^\s*progress\s*$/i.test(s);
    const flush = (endCol: number) => {
      if (curLabel && !isProgressLabel(curLabel) && curCols.length > 0) {
        labelCols.push({ label: curLabel, start: curStart, end: endCol, cols: [...curCols] });
      }
      curLabel = null; curStart = -1; curCols = [];
    };
    for (let cc = region.start; cc <= region.end; cc++) {
      // region 안에 있는 셀은 단계 영역 내부이므로 isIdentHeader 가드를 적용하지 않는다.
      // (예: STR DD 의 "Drawings" 라벨이 ident 정규식의 'drawing' 에 우연히 매칭되어 끊기던 버그 방지)
      const t = cellStr(ws, milestoneLabelRow, cc).trim();
      if (t) {
        flush(cc - 1);
        curLabel = t;
        curStart = cc;
        curCols = [cc];
      } else if (curLabel) {
        curCols.push(cc);
      }
    }
    flush(region.end);
    if (labelCols.length === 0) continue;
    const pcts = STAGE_UNLABELED_PCTS[labelCols.length] ?? labelCols.map((_, i) => Math.round(((i + 1) / labelCols.length) * 100));
    labelCols.forEach((grp, gi) => {
      const cells: { subIdx: number; col: number; incrementPct: number; planDate?: string; label?: string }[] = [];
      let incrementPct = 0;
      let planDate: string | undefined;
      let subIdx = 0;
      for (const x of grp.cols) {
        const incRaw = cellStr(ws, incrementRow, x).replace("%", "").trim();
        const v = parseFloat(incRaw);
        const cellInc = !isNaN(v) ? v : 0;
        if (cellInc <= 0) continue;
        incrementPct += cellInc;
        const pd = parseDate(cellRaw(ws, planDateRow, x));
        if (pd && (!planDate || pd > planDate)) planDate = pd;
        cells.push({ subIdx, col: x, incrementPct: cellInc, planDate: pd, label: grp.label });
        subIdx++;
      }
      if (cells.length === 0) return;
      milestoneGroups.push({
        stage: region.stage, pct: pcts[gi], label: grp.label,
        cols: grp.cols, incrementPct, planDate, cells,
      });
    });
  }

  // 행 진행도 계산용으로 호환 형태 유지
  const milestoneCols = milestoneGroups
    .slice()
    .sort((a, b) => (a.cols[0] ?? 0) - (b.cols[0] ?? 0))
    .map((g) => ({
      col: g.cols[0],
      stage: g.stage,
      pct: g.pct,
      label: g.label,
      incrementPct: g.incrementPct,
      planDate: g.planDate,
      cols: g.cols,
      cells: g.cells,
    }));



  // SD/DD/CD 단계 범위(scope) 컬럼 — headerRow에서 "SD"/"DD"/"CD" 또는 "SD Stage"/"DD Stage"/"CD Stage".
  // 마일스톤 라벨(SD50%, DD30% 등)과 구분하기 위해 % 미포함만 인식.
  // 첫 마일스톤 컬럼 시작 이전 범위에서만 탐색.
  const firstMsCol = milestoneCols.length ? Math.min(...milestoneCols.map((m) => m.col)) : maxCol + 1;
  const scopeCols: { sd?: number; dd?: number; cd?: number } = {};
  const stagePlanCols: { sd?: number; dd?: number; cd?: number } = {};
  for (let cc = noCol; cc < firstMsCol; cc++) {
    const t = cellStr(ws, headerRow, cc).trim().toUpperCase().replace(/\s+/g, " ");
    if ((t === "SD" || t === "SD STAGE") && scopeCols.sd === undefined) { scopeCols.sd = cc; stagePlanCols.sd = cc; }
    else if ((t === "DD" || t === "DD STAGE") && scopeCols.dd === undefined) { scopeCols.dd = cc; stagePlanCols.dd = cc; }
    else if ((t === "CD" || t === "CD STAGE") && scopeCols.cd === undefined) { scopeCols.cd = cc; stagePlanCols.cd = cc; }
  }

  // 부가 메타 컬럼 탐지 (Confirmed By, Document Class, 문서분류체계 코드, Plan Date IFR/IFI/IFC)
  // - headerRow(r4)에 "Plan Date", "Confirmed By", "Document Class", "문서분류" 등 라벨.
  // - headerRow+1(r5)에 "IFR/IFI", "IFC", "코드" 그룹 라벨.
  // - planDateRow(r7)에 "Start Date" / "Issue Date" 페어 구분.
  const extraCols: {
    confirmedBy?: number;
    documentClass?: number;
    docClassCode?: number;
    ifrStart?: number;
    ifrIssue?: number;
    ifcStart?: number;
    ifcIssue?: number;
  } = {};
  for (let c = noCol; c <= maxCol; c++) {
    const h4 = cellStr(ws, headerRow, c).toLowerCase().replace(/\s+/g, " ").trim();
    const h5 = cellStr(ws, headerRow + 1, c).toLowerCase().replace(/\s+/g, " ").trim();
    const h7 = cellStr(ws, planDateRow, c).toLowerCase().replace(/\s+/g, " ").trim();
    if (h4.includes("confirmed") && extraCols.confirmedBy === undefined) extraCols.confirmedBy = c;
    if (h4.includes("document class") && extraCols.documentClass === undefined) extraCols.documentClass = c;
    if ((h4.includes("문서분류") || h5 === "코드" || h4 === "코드") && extraCols.docClassCode === undefined) extraCols.docClassCode = c;
    if (/ifr\/?ifi/i.test(h5) || /ifr\/?ifi/i.test(h4)) {
      if (h7.includes("issue") && extraCols.ifrIssue === undefined) extraCols.ifrIssue = c;
      else if (extraCols.ifrStart === undefined) extraCols.ifrStart = c;
    } else if (/^ifc/i.test(h5) || /^ifc/i.test(h4)) {
      if (h7.includes("issue") && extraCols.ifcIssue === undefined) extraCols.ifcIssue = c;
      else if (extraCols.ifcStart === undefined) extraCols.ifcStart = c;
    }
  }

  // planDateRow에 날짜가 하나라도 있으면 데이터는 그 다음 행, 없으면 incrementRow 다음 행에서 시작
  const hasPlanDates = milestoneCols.some((mc) => mc.planDate);
  const dataStartRow = hasPlanDates ? planDateRow + 1 : incrementRow + 1;

  // (DISCIPLINE 컬럼 override는 부작용 때문에 제거. 시트명 헬퍼만 사용)


  // 2) 데이터 행 파싱
  // 마일스톤 컬럼 위치 set (rawRowCells 에서 제외 — 그건 progress 로 따로 저장됨)
  const milestoneColSet = new Set<number>();
  for (const g of milestoneGroups) for (const x of g.cols) milestoneColSet.add(x);
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

    const milestonesAll: MdrMilestoneDef[] = milestoneCols.map((m) => ({
      stage: m.stage,
      pct: m.pct,
      incrementPct: m.incrementPct,
      planDate: m.planDate,
      label: m.label,
      cells: m.cells.map((cc) => ({
        subIdx: cc.subIdx,
        incrementPct: cc.incrementPct,
        planDate: cc.planDate,
        label: cc.label,
      })),
    }));

    // 셀 단위 progress: 그룹 OR 아닌 서브컬럼별 Y/N (increment > 0 셀만)
    const progressAll: { stage: MdrStage; pct: number; subIdx: number; isDone: boolean }[] = [];
    for (const m of milestoneCols) {
      for (const cc of m.cells) {
        const isDone = isYes(cellStr(ws, r, cc.col));
        progressAll.push({ stage: m.stage, pct: m.pct, subIdx: cc.subIdx, isDone });
      }
    }

    // 단계 범위(scope) 판정: 헤더 컬럼이 있으면 셀 값으로 결정.
    // 헤더 컬럼이 없으면 폴백으로 그 단계 마일스톤이 정의되어 있고 increment 합이 0 초과인지로 판정.
    const stageInScopeByMs = (stage: MdrStage): boolean => {
      const sum = milestonesAll
        .filter((m) => m.stage === stage)
        .reduce((s, m) => s + (m.incrementPct || 0), 0);
      return sum > 0;
    };
    const inScope = {
      sd: scopeCols.sd !== undefined
        ? isYes(cellStr(ws, r, scopeCols.sd))
        : stageInScopeByMs("SD"),
      dd: scopeCols.dd !== undefined
        ? isYes(cellStr(ws, r, scopeCols.dd))
        : stageInScopeByMs("DD"),
      cd: scopeCols.cd !== undefined
        ? isYes(cellStr(ws, r, scopeCols.cd))
        : stageInScopeByMs("CD"),
    };

    // 범위 밖 단계의 마일스톤·진행률은 저장하지 않는다 (도면수·진척·weight 모두 0 처리).
    const stageOk = (s: MdrStage) =>
      (s === "SD" && inScope.sd) || (s === "DD" && inScope.dd) || (s === "CD" && inScope.cd);
    const milestones = milestonesAll.filter((m) => stageOk(m.stage));
    const progress = progressAll.filter((p) => stageOk(p.stage));

    // plan finish: 마일스톤 중 가장 늦은 plan_date
    const lastPlan = milestones
      .map((m) => m.planDate)
      .filter((x): x is string => Boolean(x))
      .sort()
      .pop();

    // out of scope: 세 단계 모두 범위 밖이거나, 범위 안 단계의 increment 합이 모두 0
    const noStage = !inScope.sd && !inScope.dd && !inScope.cd;
    const allZero = milestones.length > 0 && milestones.every((m) => m.incrementPct === 0);
    const outOfScope = noStage || allZero;

    // itemNo: 행의 DISCIPLINE 값을 우선 사용 (한 시트에 여러 하위 discipline이 섞여도 itemNo 충돌 방지)
    const discCode = (discRaw || discipline).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || discipline;
    const itemNo = `${building}-${discCode}-${sourceNo}`;
    const plantId = findVal("Plant ID", "PLANT", "JOB");
    const pbs = findVal("PBS", "Area Code", "AREA");
    const fbs = findVal("FBS", "Function Code", "FUNCTION", "FUCTION");
    // SER.NO. 헤더는 "SER. NO.", "SER.NO.", "SER NO" 등 공백/점 변형 다수.
    // findVal substring 매칭은 공백 변형에 약하므로 정규식으로 직접 매칭.
    const serHeader = headers.find((h) =>
      /^\s*ser\.?\s*no\.?\s*$/i.test(h.text) || /serial/i.test(h.text),
    );
    const serNo = serHeader ? (cellStr(ws, r, serHeader.col) || undefined) : undefined;
    const revRaw = findVal("REV", "REVISION");
    const rev = (revRaw && revRaw.trim()) ? revRaw.trim().toUpperCase() : "A";
    // docBase: 4개 토큰을 항상 join. 누락 토큰은 빈 문자열로 유지(예: "JOB1--FBS3-SER9").
    // 4개 모두 누락이면 fallback으로 sheet+row 기반 키 생성(빌딩 내 UNIQUE 만족용).
    const PLACEHOLDER_RE = /^(tbd|tba|n\/a|na|미정|tbc|-)$/i;
    const normTok = (t: string | undefined) => {
      const v = (t ?? "").trim();
      return PLACEHOLDER_RE.test(v) ? "" : v;
    };
    const tPlant = normTok(plantId);
    const tPbs = normTok(pbs);
    const tFbs = normTok(fbs);
    const tSer = normTok(serNo);
    const missingTokens = {
      plantId: tPlant.length === 0,
      pbs: tPbs.length === 0,
      fbs: tFbs.length === 0,
      serNo: tSer.length === 0,
    };
    const allMissing = missingTokens.plantId && missingTokens.pbs && missingTokens.fbs && missingTokens.serNo;
    const docBase = allMissing
      ? `__UNKNOWN__-${sheetName}-${r + 1}`
      : [tPlant, tPbs, tFbs, tSer].join("-");
    const docNo = `${docBase}-${rev}`;

    const readDateAt = (c: number | undefined) =>
      c !== undefined ? parseDate(cellRaw(ws, r, c)) : undefined;
    const readStrAt = (c: number | undefined) => {
      if (c === undefined) return undefined;
      const v = cellStr(ws, r, c);
      return v && !/^(tbd|tba|n\/a|na|미정|tbc|-)$/i.test(v) ? v : undefined;
    };

    // 원본 행의 모든 셀(헤더→값) 수집 — 마일스톤 Y/N 컬럼은 별도로 progress 에 저장되므로 제외.
    const rawRowCells: Record<string, string | number | boolean | null> = {};
    for (let cc = range.s.c; cc <= maxCol; cc++) {
      if (milestoneColSet.has(cc)) continue;
      const header = headerTextAt(cc).trim();
      if (!header) continue;
      const cell = cellRaw(ws, r, cc);
      if (!cell || cell.v === undefined || cell.v === null) continue;
      let value: string | number | boolean | null;
      if (typeof cell.v === "number") {
        // 날짜셀이면 ISO 로 변환
        if (cell.t === "n" && (cell.z || cell.w)) {
          const iso = parseDate(cell);
          value = iso ?? cell.v;
        } else value = cell.v;
      } else if (typeof cell.v === "boolean") value = cell.v;
      else value = String(cell.v);
      rawRowCells[header] = value;
    }

    rows.push({
      sourceNo,
      itemNo,
      building,
      discipline: discRaw,
      plantId,
      pbs,
      fbs,
      serNo,
      rev,
      docBase,
      docNo,
      missingTokens,
      activityGroup: findVal("Activity Group", "GROUP"),
      drawingTitle: title,
      planFinish: lastPlan,
      outOfScope,
      inScope,
      confirmedBy: readStrAt(extraCols.confirmedBy),
      ifrStartDate: readDateAt(extraCols.ifrStart),
      ifrIssueDate: readDateAt(extraCols.ifrIssue),
      ifcStartDate: readDateAt(extraCols.ifcStart),
      ifcIssueDate: readDateAt(extraCols.ifcIssue),
      documentClass: readStrAt(extraCols.documentClass),
      docClassCode: readStrAt(extraCols.docClassCode),
      stagePlanSd: readDateAt(stagePlanCols.sd),
      stagePlanDd: readDateAt(stagePlanCols.dd),
      stagePlanCd: readDateAt(stagePlanCols.cd),
      sourceSheet: sheetName,
      rawRowNo: r + 1,
      milestones,
      progress,
      rawRowCells,
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
