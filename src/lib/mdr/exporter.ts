import XLSXStyle from "xlsx-js-style";
import * as XLSX from "xlsx";
import { MDR_REIMPORT_MARKER, MDR_COLUMN_MAP } from "./columnMap";

export interface MdrExportDrawing {
  sourceNo: string;
  building: string;
  itemNo: string;
  discipline?: string;
  jobNo?: string;
  areaCode?: string;
  functionCode?: string;
  serialNo?: string;
  activityGroup?: string;
  drawingTitle?: string;
  outOfScope?: boolean;
  /** stage-pct → isDone */
  progress: Record<string, boolean>;
}

/**
 * 업로드된 원본 워크북(template_blob)을 템플릿으로 로드하여
 * - 셀 스타일(s)은 보존
 * - 셀 값(v)만 현재 DB 상태로 패치
 * - 좌측에 Building, Item No 컬럼을 삽입
 * - SD 컬럼은 항상 Y
 * - 재임포트 마커를 Defined Name으로 삽입
 */
export function exportFromTemplate(
  templateBlob: ArrayBuffer,
  drawings: MdrExportDrawing[],
): ArrayBuffer {
  // xlsx-js-style은 스타일까지 read/write 가능
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

  // 좌측 컬럼 2개 삽입(Building, Item No.) — 헤더 행에 셀 추가 (기존 셀은 우측으로 시프트하지 않고, 단순히 좌측 빈 영역에 컬럼 헤더만 적어 사용자 인지용)
  // ※ 진정한 컬럼 시프트는 큰 워크북에서 비용이 크므로, 본 구현은 NO 컬럼 왼쪽의 빈 셀에 헤더와 값을 채우는 방식으로 구현
  const buildingCol = Math.max(0, noCol - 2);
  const itemNoCol = Math.max(0, noCol - 1);
  setHeader(ws, headerRow, buildingCol, MDR_COLUMN_MAP.building.header);
  setHeader(ws, headerRow, itemNoCol, MDR_COLUMN_MAP.itemNo.header);

  // 데이터 행 패치
  for (let r = headerRow + 3; r <= range.e.r; r++) {
    const sourceNo = String(ws[XLSX.utils.encode_cell({ r, c: noCol })]?.v ?? "").trim();
    if (!sourceNo) continue;
    const row = drawings.find((d) => d.sourceNo === sourceNo);
    if (!row) continue;
    setVal(ws, r, buildingCol, row.building);
    setVal(ws, r, itemNoCol, row.itemNo);

    // 마일스톤 컬럼 — 헤더 텍스트에서 stage/pct 추정 후 Y/공백 set
    for (let c = noCol + 1; c <= range.e.c; c++) {
      const head = String(ws[XLSX.utils.encode_cell({ r: headerRow, c })]?.v ?? "");
      const m = head.match(/(SD|DD|CD)\s*(\d{1,3})\s*%/i);
      if (!m) continue;
      const stage = m[1].toUpperCase();
      const pct = parseInt(m[2], 10);
      const key = `${stage}-${pct}`;
      let done = row.progress[key];
      if (stage === "SD") done = true; // SD 항상 Y
      setVal(ws, r, c, done ? "Y" : "");
    }
  }

  // ref 확장 (좌측 컬럼 사용 반영)
  range.s.c = Math.min(range.s.c, buildingCol);
  ws["!ref"] = XLSX.utils.encode_range(range);
}

function setHeader(ws: XLSX.WorkSheet, r: number, c: number, text: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const ref = ws[XLSX.utils.encode_cell({ r, c: c + 1 })];
  ws[addr] = { t: "s", v: text, s: ref?.s ?? { font: { bold: true } } };
}
function setVal(ws: XLSX.WorkSheet, r: number, c: number, v: string | number | boolean) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const prev = ws[addr];
  ws[addr] = { t: typeof v === "number" ? "n" : "s", v, s: prev?.s };
}
