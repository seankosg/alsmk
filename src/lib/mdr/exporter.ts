import XLSXStyle from "xlsx-js-style";
import * as XLSX from "xlsx";
import { MDR_REIMPORT_MARKER, MDR_COLUMN_MAP, detectColumnKey, type MdrColumnKey } from "./columnMap";

export interface MdrExportDrawing {
  sourceNo: string;
  building: string;
  itemNo: string;
  discipline?: string;
  plantId?: string;
  pbs?: string;
  fbs?: string;
  serNo?: string;
  activityGroup?: string;
  drawingTitle?: string;
  outOfScope?: boolean;
  /** 앱이 관리하는 메타 (Excel 원본을 덮어쓰는 기준값) */
  confirmedBy?: string | null;
  ifrStartDate?: string | null;
  ifrIssueDate?: string | null;
  ifcStartDate?: string | null;
  ifcIssueDate?: string | null;
  documentClass?: string | null;
  docClassCode?: string | null;
  stagePlanSd?: string | null;
  stagePlanDd?: string | null;
  stagePlanCd?: string | null;
  rev?: string;
  /** 원본 행의 헤더→값 사전 (앱 비관리 컬럼의 round-trip 보존) */
  rawRowCells?: Record<string, unknown> | null;
  /** stage-pct → isDone */
  progress: Record<string, boolean>;
}

/** 컬럼키 → MdrExportDrawing 필드 값 매핑 */
function valueForColumnKey(d: MdrExportDrawing, key: MdrColumnKey): unknown {
  switch (key) {
    case "no": return d.sourceNo;
    case "building": return d.building;
    case "docNo": return ""; // doc_no 는 docBase-rev 조합. 본 코드에서는 ser_no 등으로 재구성됨; 비워 둠.
    case "itemNo": return d.itemNo;
    case "discipline": return d.discipline ?? "";
    case "plantId": return d.plantId ?? "";
    case "pbs": return d.pbs ?? "";
    case "fbs": return d.fbs ?? "";
    case "serNo": return d.serNo ?? "";
    case "activityGroup": return d.activityGroup ?? "";
    case "drawingTitle": return d.drawingTitle ?? "";
    case "confirmedBy": return d.confirmedBy ?? "";
    case "ifrStart": return d.ifrStartDate ?? "";
    case "ifrIssue": return d.ifrIssueDate ?? "";
    case "ifcStart": return d.ifcStartDate ?? "";
    case "ifcIssue": return d.ifcIssueDate ?? "";
    case "documentClass": return d.documentClass ?? "";
    case "docClassCode": return d.docClassCode ?? "";
    case "stagePlanSd": return d.stagePlanSd ?? "";
    case "stagePlanDd": return d.stagePlanDd ?? "";
    case "stagePlanCd": return d.stagePlanCd ?? "";
    default: return undefined;
  }
}

/**
 * 업로드된 원본 워크북(template_blob)을 템플릿으로 로드하여
 * - 셀 스타일(s), 머지, 열 너비 모두 보존
 * - 앱이 관리하는 필드는 DB 값으로 덮어씀 (마일스톤 Y/N, 메타, 목표완료일 등)
 * - 미인식 컬럼은 템플릿 원본 유지 / 신규 추가 도면은 rawRowCells 폴백
 * - 시트에 없는 신규 도면은 마지막에 append
 * - 재임포트 마커를 Defined Name으로 삽입
 */
export function exportFromTemplate(
  templateBlob: ArrayBuffer,
  drawings: MdrExportDrawing[],
): ArrayBuffer {
  const wb = XLSXStyle.read(templateBlob, { type: "array", cellStyles: true, cellNF: true });

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    patchSheet(ws, drawings);
  }

  // 재임포트 마커
  wb.Workbook = wb.Workbook ?? {};
  wb.Workbook.Names = wb.Workbook.Names ?? [];
  if (!wb.Workbook.Names.some((n) => n.Name === "ALSMK_MDR_REIMPORT_V1")) {
    wb.Workbook.Names.push({
      Name: "ALSMK_MDR_REIMPORT_V1",
      Ref: `"${MDR_REIMPORT_MARKER}"`,
    });
  }

  const out = XLSXStyle.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
  return out as ArrayBuffer;
}

function patchSheet(ws: XLSX.WorkSheet, drawings: MdrExportDrawing[]) {
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  // 헤더 anchor (NO. 셀)
  let headerRow = -1;
  let noCol = -1;
  for (let r = range.s.r; r <= Math.min(range.s.r + 30, range.e.r) && headerRow < 0; r++) {
    for (let c = range.s.c; c <= Math.min(range.s.c + 8, range.e.c); c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const v = String(ws[addr]?.v ?? "").trim().toUpperCase().replace(/\s+/g, "");
      if (v === "NO." || v === "NO") { headerRow = r; noCol = c; break; }
    }
  }
  if (headerRow < 0) return;

  // 좌측 Building/Item No. 헤더 인덱스 (기존 동작 유지)
  const buildingCol = Math.max(0, noCol - 2);
  const itemNoCol = Math.max(0, noCol - 1);
  setHeader(ws, headerRow, buildingCol, MDR_COLUMN_MAP.building.header);
  setHeader(ws, headerRow, itemNoCol, MDR_COLUMN_MAP.itemNo.header);

  // 헤더 컬럼 텍스트 사전 구축 — c → { rawHeader, columnKey, milestone:{stage,pct}|null }
  type HeaderInfo = {
    rawHeader: string;
    columnKey: MdrColumnKey | null;
    milestone: { stage: string; pct: number } | null;
  };
  const headerByCol = new Map<number, HeaderInfo>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const raw = String(ws[XLSX.utils.encode_cell({ r: headerRow, c })]?.v ?? "").trim();
    if (!raw) continue;
    const ms = raw.match(/(SD|DD|CD)\s*(\d{1,3})\s*%/i);
    headerByCol.set(c, {
      rawHeader: raw,
      columnKey: ms ? null : detectColumnKey(raw),
      milestone: ms ? { stage: ms[1].toUpperCase(), pct: parseInt(ms[2], 10) } : null,
    });
  }

  // 기존 데이터 행: source_no(NO. 컬럼) 매칭 → 덮어쓰기
  const matchedSourceNos = new Set<string>();
  const lastDataRow = range.e.r;
  for (let r = headerRow + 3; r <= lastDataRow; r++) {
    const sourceNo = String(ws[XLSX.utils.encode_cell({ r, c: noCol })]?.v ?? "").trim();
    if (!sourceNo) continue;
    const row = drawings.find((d) => d.sourceNo === sourceNo);
    if (!row) continue;
    matchedSourceNos.add(sourceNo);

    setVal(ws, r, buildingCol, row.building);
    setVal(ws, r, itemNoCol, row.itemNo);
    writeRowCells(ws, r, headerByCol, row, /*useRawFallback=*/ false);
  }

  // 신규 도면 (시트에 행이 없던 도면) → 마지막에 append
  const newRows = drawings.filter((d) => !matchedSourceNos.has(d.sourceNo));
  let appendRow = lastDataRow;
  for (const row of newRows) {
    appendRow++;
    // 직전 행의 스타일을 컬럼별로 복사하여 시각적 일관성 유지
    for (const [c] of headerByCol) {
      const refAddr = XLSX.utils.encode_cell({ r: lastDataRow, c });
      const newAddr = XLSX.utils.encode_cell({ r: appendRow, c });
      const ref = ws[refAddr];
      ws[newAddr] = { t: "s", v: "", s: ref?.s };
    }
    setVal(ws, appendRow, noCol, row.sourceNo);
    setVal(ws, appendRow, buildingCol, row.building);
    setVal(ws, appendRow, itemNoCol, row.itemNo);
    writeRowCells(ws, appendRow, headerByCol, row, /*useRawFallback=*/ true);
  }

  // ref 확장
  range.s.c = Math.min(range.s.c, buildingCol);
  range.e.r = Math.max(range.e.r, appendRow);
  ws["!ref"] = XLSX.utils.encode_range(range);
}

/**
 * 한 행에 대해 모든 컬럼을 덮어쓴다.
 * - 마일스톤 Y/N: 항상 drawing.progress 기준 (SD 는 강제 Y)
 * - 인식 컬럼키: drawing 필드 값 사용
 * - 미인식 컬럼: useRawFallback=true 인 경우에만 rawRowCells[rawHeader] 폴백 (기존 행은 템플릿 원본 유지)
 */
function writeRowCells(
  ws: XLSX.WorkSheet,
  r: number,
  headerByCol: Map<number, { rawHeader: string; columnKey: MdrColumnKey | null; milestone: { stage: string; pct: number } | null }>,
  drawing: MdrExportDrawing,
  useRawFallback: boolean,
) {
  for (const [c, info] of headerByCol) {
    if (info.milestone) {
      const { stage, pct } = info.milestone;
      const key = `${stage}-${pct}`;
      let done = drawing.progress[key];
      if (stage === "SD") done = true;
      setVal(ws, r, c, done ? "Y" : "");
      continue;
    }
    if (info.columnKey) {
      const v = valueForColumnKey(drawing, info.columnKey);
      if (v !== undefined && v !== null && v !== "") {
        setVal(ws, r, c, v as string | number | boolean);
      } else if (useRawFallback && drawing.rawRowCells) {
        const fb = drawing.rawRowCells[info.rawHeader];
        if (fb !== undefined && fb !== null && fb !== "") setVal(ws, r, c, fb as string | number | boolean);
      }
      continue;
    }
    // 미인식 컬럼: 신규 append 행만 raw 폴백
    if (useRawFallback && drawing.rawRowCells) {
      const fb = drawing.rawRowCells[info.rawHeader];
      if (fb !== undefined && fb !== null && fb !== "") setVal(ws, r, c, fb as string | number | boolean);
    }
  }
}

function setHeader(ws: XLSX.WorkSheet, r: number, c: number, text: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const ref = ws[XLSX.utils.encode_cell({ r, c: c + 1 })];
  ws[addr] = { t: "s", v: text, s: ref?.s ?? { font: { bold: true } } };
}
function setVal(ws: XLSX.WorkSheet, r: number, c: number, v: string | number | boolean) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const prev = ws[addr];
  ws[addr] = { t: typeof v === "number" ? "n" : (typeof v === "boolean" ? "b" : "s"), v, s: prev?.s };
}
