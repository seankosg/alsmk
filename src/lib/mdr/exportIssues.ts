import XLSX from "xlsx-js-style";
import {
  FONT_NAME,
  STYLE_HEADER,
  STYLE_DATA,
  STYLE_DATA_CENTER,
  STYLE_DATA_RIGHT,
  timestampForFilename,
} from "@/lib/excelStyles";

export interface IssueRowLog {
  source_sheet: string | null;
  raw_row_no: number | null;
  item_no: string | null;
  source_no: string | null;
  drawing_title: string | null;
  doc_base: string | null;
  action: string;
  reason: string | null;
}

const ZEBRA_FILL = { fgColor: { rgb: "FFF8FAFC" } } as const;
const TITLE_STYLE = {
  font: { name: FONT_NAME, sz: 14, bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { fgColor: { rgb: "FF1E3A8A" } },
  alignment: { vertical: "center", horizontal: "left" },
} as const;
const META_STYLE = {
  font: { name: FONT_NAME, sz: 10, color: { rgb: "FF475569" } },
  alignment: { vertical: "center", horizontal: "left" },
} as const;

function zebraize<T extends Record<string, unknown>>(base: T, rowIndex: number): T {
  if (rowIndex % 2 === 1) return { ...base, fill: ZEBRA_FILL } as T;
  return base;
}

function writeCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: unknown,
  style: Record<string, unknown>,
  type: "s" | "n" = "s",
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (type === "n" && typeof value === "number") {
    ws[addr] = { t: "n", v: value, s: style };
  } else {
    ws[addr] = { t: "s", v: value == null ? "" : String(value), s: style };
  }
}

function setRange(ws: XLSX.WorkSheet, lastRow: number, lastCol: number) {
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
}

interface ColSpec {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  type?: "s" | "n";
}

function buildSheet(
  title: string,
  cols: ColSpec[],
  rows: (string | number | null | undefined)[][],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const lastCol = cols.length - 1;

  // Row 0: Title (merged across columns)
  writeCell(ws, 0, 0, title, TITLE_STYLE);
  for (let c = 1; c <= lastCol; c++) writeCell(ws, 0, c, "", TITLE_STYLE);

  // Row 1: meta (export time, total count)
  const meta = `Exported ${new Date().toLocaleString()}  ·  ${rows.length.toLocaleString()}건`;
  writeCell(ws, 1, 0, meta, META_STYLE);
  for (let c = 1; c <= lastCol; c++) writeCell(ws, 1, c, "", META_STYLE);

  // Row 2: headers
  cols.forEach((col, i) => writeCell(ws, 2, i, col.header, STYLE_HEADER));

  // Data rows from row 3
  rows.forEach((row, ri) => {
    const r = ri + 3;
    cols.forEach((col, i) => {
      const baseStyle =
        col.align === "right" ? STYLE_DATA_RIGHT :
        col.align === "center" ? STYLE_DATA_CENTER :
        STYLE_DATA;
      const style = zebraize(baseStyle as Record<string, unknown>, ri);
      const v = row[i];
      writeCell(ws, r, i, v ?? "", style, col.type === "n" ? "n" : "s");
    });
  });

  const lastRow = Math.max(2, rows.length + 2);
  setRange(ws, lastRow, lastCol);

  // Column widths
  ws["!cols"] = cols.map((c) => ({ wch: c.width }));

  // Row heights: title 28, meta 18, header 28, data 18
  const rowHeights: { hpt: number }[] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 28 }];
  for (let i = 0; i < rows.length; i++) rowHeights.push({ hpt: 18 });
  ws["!rows"] = rowHeights;

  // Merges for title & meta
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];

  // Freeze panes: top 3 rows (split below header)
  ws["!freeze"] = { xSplit: 0, ySplit: 3 } as never;
  (ws as { "!frozen"?: unknown })["!frozen"] = { r: 3, c: 0 };

  // AutoFilter on header row
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 2, c: 0 },
      e: { r: lastRow, c: lastCol },
    }),
  };

  return ws;
}

export interface BatchInfo {
  filename: string;
  building_code: string | null;
  status: string;
  imported_at: string;
  error_summary: string | null;
}

export function exportImportIssues(batch: BatchInfo, rowLogs: IssueRowLog[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 중복
  const duplicates = rowLogs
    .filter((r) => r.action === "skipped_duplicate")
    .sort((a, b) => {
      const sa = (a.source_sheet ?? "").localeCompare(b.source_sheet ?? "");
      if (sa !== 0) return sa;
      return (a.raw_row_no ?? 0) - (b.raw_row_no ?? 0);
    });

  const dupCols: ColSpec[] = [
    { header: "Row #", width: 8, align: "right", type: "n" },
    { header: "Sheet", width: 14, align: "center" },
    { header: "Doc No (base)", width: 34 },
    { header: "Item No", width: 24 },
    { header: "Source No", width: 12, align: "right" },
    { header: "Title", width: 60 },
    { header: "Reason", width: 50 },
  ];
  const dupRows = duplicates.map((r) => [
    r.raw_row_no ?? "",
    r.source_sheet ?? "",
    r.doc_base ?? "",
    r.item_no ?? "",
    r.source_no ?? "",
    r.drawing_title ?? "",
    r.reason ?? "",
  ]);
  const wsDup = buildSheet(`중복 (Duplicate) — ${batch.filename}`, dupCols, dupRows);
  XLSX.utils.book_append_sheet(wb, wsDup, "중복 (Duplicate)");

  // Sheet 2: 파싱 오류
  const errCols: ColSpec[] = [
    { header: "구분", width: 14, align: "center" },
    { header: "위치", width: 24 },
    { header: "내용", width: 90 },
  ];
  const errRows: (string | number)[][] = [];
  if (batch.error_summary && batch.error_summary.trim()) {
    errRows.push(["Batch Error", "—", batch.error_summary.trim()]);
  }
  const errorPattern = /(error|failed|오류|실패|skip)/i;
  rowLogs.forEach((r) => {
    if (r.action === "skipped_duplicate") return;
    if (r.reason && errorPattern.test(r.reason) && r.action !== "skipped_existing") {
      const loc = `${r.source_sheet ?? "?"}!Row #${r.raw_row_no ?? "?"}`;
      errRows.push(["Row Error", loc, r.reason]);
    }
  });
  const wsErr = buildSheet(`파싱 오류 (Parse Errors) — ${batch.filename}`, errCols, errRows);
  XLSX.utils.book_append_sheet(wb, wsErr, "파싱 오류");

  // Filename
  const base = batch.filename.replace(/\.[^.]+$/, "");
  const fname = `${base}_import-issues_${timestampForFilename()}.xlsx`;
  XLSX.writeFile(wb, fname);
}
