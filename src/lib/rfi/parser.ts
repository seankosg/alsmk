import * as XLSX from "xlsx";

export interface RfiRawEvent {
  raw_no: number | null;
  raw_status: string | null;
  rfi_no: string;
  from_party: string | null;
  to_party: string | null;
  title: string | null;
  discipline: string | null;
  originator: string | null;
  issue_date: string | null;
  due_date: string | null;
  finish_date: string | null;
}

export interface RfiParseResult {
  filename: string;
  rows: RfiRawEvent[];
}

function toDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  // Try Date.parse
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function norm(s: any): string {
  return String(s ?? "").trim().toLowerCase().replace(/[\s._/-]+/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  no: ["no", "번호"],
  status: ["status", "상태"],
  rfi_no: ["rfitqno", "rfino", "tqno", "문서번호"],
  from: ["from", "발신"],
  to: ["to", "수신"],
  title: ["title", "제목"],
  disp: ["disp", "discipline", "분류", "분야"],
  originator: ["originator", "기안자"],
  issue: ["rfitqissuedate", "issuedate", "발행일"],
  due: ["duedate", "답변기한", "기한"],
  finish: ["finishdate", "완료일"],
};

function findHeader(rows: any[][]): { headerRowIdx: number; colMap: Record<string, number> } {
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r] ?? [];
    const map: Record<string, number> = {};
    for (let c = 0; c < row.length; c++) {
      const n = norm(row[c]);
      if (!n) continue;
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (map[key] != null) continue;
        if (aliases.some((a) => n === a || n.includes(a))) map[key] = c;
      }
    }
    if (map.rfi_no != null && map.from != null && map.to != null && map.title != null) {
      return { headerRowIdx: r, colMap: map };
    }
  }
  throw new Error("RFI 헤더행을 찾지 못했습니다.");
}

export async function parseRfiFile(file: File): Promise<RfiParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sn = wb.SheetNames[0];
  const ws = wb.Sheets[sn];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const { headerRowIdx, colMap } = findHeader(rows);
  const out: RfiRawEvent[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rfi_no = String(row[colMap.rfi_no] ?? "").trim();
    if (!rfi_no) continue;
    const noVal = row[colMap.no];
    const rawNo = noVal == null || noVal === "" ? null : Number(noVal);
    out.push({
      raw_no: Number.isFinite(rawNo as number) ? (rawNo as number) : null,
      raw_status: colMap.status != null ? (row[colMap.status] ? String(row[colMap.status]).trim() : null) : null,
      rfi_no,
      from_party: colMap.from != null ? (row[colMap.from] ? String(row[colMap.from]).trim() : null) : null,
      to_party: colMap.to != null ? (row[colMap.to] ? String(row[colMap.to]).trim() : null) : null,
      title: colMap.title != null ? (row[colMap.title] ? String(row[colMap.title]).trim() : null) : null,
      discipline: colMap.disp != null ? (row[colMap.disp] ? String(row[colMap.disp]).trim() : null) : null,
      originator: colMap.originator != null ? (row[colMap.originator] ? String(row[colMap.originator]).trim() : null) : null,
      issue_date: colMap.issue != null ? toDate(row[colMap.issue]) : null,
      due_date: colMap.due != null ? toDate(row[colMap.due]) : null,
      finish_date: colMap.finish != null ? toDate(row[colMap.finish]) : null,
    });
  }
  return { filename: file.name, rows: out };
}
