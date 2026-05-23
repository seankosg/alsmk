// Shared Excel styles & helpers (ported from SHAW PROJECT CMS pattern).
// Use with `xlsx-js-style`.
import XLSX from "xlsx-js-style";

export const FONT_NAME = "Calibri";

export const STYLE_TITLE = {
  font: { name: FONT_NAME, sz: 14, bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { fgColor: { rgb: "FF1E3A5F" } },
  alignment: { vertical: "center", horizontal: "left" },
} as const;

export const STYLE_META_LABEL = {
  font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: "FF374151" } },
  fill: { fgColor: { rgb: "FFF3F4F6" } },
  alignment: { vertical: "center", horizontal: "left" },
} as const;

export const STYLE_META_VALUE = {
  font: { name: FONT_NAME, sz: 10, color: { rgb: "FF111827" } },
  fill: { fgColor: { rgb: "FFF3F4F6" } },
  alignment: { vertical: "center", horizontal: "left", wrapText: true },
} as const;

const THIN_DARK = { style: "thin", color: { rgb: "FF1F2937" } } as const;
const THIN_LIGHT = { style: "thin", color: { rgb: "FFE5E7EB" } } as const;

export const STYLE_HEADER = {
  font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { fgColor: { rgb: "FF334155" } },
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
  border: { top: THIN_DARK, bottom: THIN_DARK, left: THIN_DARK, right: THIN_DARK },
} as const;

export const STYLE_DATA = {
  font: { name: FONT_NAME, sz: 10, color: { rgb: "FF111827" } },
  alignment: { vertical: "center", horizontal: "left", wrapText: true },
  border: { top: THIN_LIGHT, bottom: THIN_LIGHT, left: THIN_LIGHT, right: THIN_LIGHT },
} as const;

export const STYLE_DATA_CENTER = {
  ...STYLE_DATA,
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
} as const;

export const STYLE_DATA_RIGHT = {
  ...STYLE_DATA,
  alignment: { vertical: "center", horizontal: "right" },
} as const;

export const STYLE_SUMMARY = {
  ...STYLE_DATA,
  font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: "FF0F172A" } },
  fill: { fgColor: { rgb: "FFDBEAFE" } },
} as const;

export const STYLE_SUMMARY_CENTER = {
  ...STYLE_SUMMARY,
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
} as const;

export const STYLE_SUMMARY_RIGHT = {
  ...STYLE_SUMMARY,
  alignment: { vertical: "center", horizontal: "right" },
} as const;

export const STYLE_GAP_POS = {
  ...STYLE_DATA_RIGHT,
  font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: "FF15803D" } },
} as const;

export const STYLE_GAP_NEG = {
  ...STYLE_DATA_RIGHT,
  font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: "FFB91C1C" } },
} as const;

export const PCT_NUMFMT = '0"%"';
export const DATE_NUMFMT = "dd-mmm-yy";

export function setCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: unknown,
  style: Record<string, unknown>,
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const v = value == null ? "" : value;
  ws[addr] = { t: "s", v: String(v), s: style };
}

export function setNumberCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: number,
  numFmt: string,
  style: Record<string, unknown>,
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { t: "n", v: value, z: numFmt, s: { ...style, numFmt } };
}

// Convert YYYY-MM-DD or ISO string to Excel serial (1900 date system).
export function isoToExcelSerial(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  // Excel epoch: 1899-12-30 (accounts for the 1900 leap-year bug)
  const utc = Date.UTC(y, mo - 1, d);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}

export function setDateCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  serial: number,
  style: Record<string, unknown>,
  numFmt = DATE_NUMFMT,
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { t: "n", v: serial, z: numFmt, s: { ...style, numFmt } };
}

export function timestampForFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function exportedTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
