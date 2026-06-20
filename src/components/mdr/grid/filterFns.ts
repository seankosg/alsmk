// SHAW DefectRawDataPage 패턴 포팅: TanStack table 필터 함수 4종
export const EMPTY_TOKEN = "__EMPTY__";

export const tokenizeAnd = (text: string): string[] =>
  String(text ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

export const matchesAllTokens = (haystack: string, query: string): boolean => {
  const tokens = tokenizeAnd(query);
  if (tokens.length === 0) return true;
  const lower = String(haystack ?? "").toLowerCase();
  return tokens.every((tok) => lower.includes(tok));
};

export const formatPct = (v: any): string => {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${Math.round(n)}%`;
};

export const multiSelectFilterFn = (row: any, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId);
  const isEmpty = val == null || val === "";
  if (filterValue.includes(EMPTY_TOKEN) && isEmpty) return true;
  if (isEmpty) return false;
  return filterValue.includes(String(val));
};

export const textFilterFn = (row: any, columnId: string, filterValue: any) => {
  if (!filterValue) return true;
  const text = typeof filterValue === "string" ? filterValue : filterValue?.text;
  const emptyOnly = typeof filterValue === "object" ? filterValue?.emptyOnly : false;
  const val = row.getValue(columnId);
  if (emptyOnly) return val == null || String(val).trim() === "";
  if (!text) return true;
  if (val == null) return false;
  return matchesAllTokens(String(val), String(text));
};

export const dateRangeFilterFn = (row: any, columnId: string, filterValue: any) => {
  if (!filterValue) return true;
  const { from, to, emptyOnly } = filterValue;
  const val = row.getValue(columnId) as string | null;
  if (emptyOnly) return val == null || val === "";
  if (!from && !to) return true;
  if (!val) return false;
  const iso = String(val).slice(0, 10);
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
};

export const progressFilterFn = (row: any, columnId: string, filterValue: any) => {
  if (!filterValue) return true;
  const { text, emptyOnly } = filterValue;
  const val = row.getValue(columnId);
  if (emptyOnly) return val == null || val === "";
  if (!text) return true;
  return matchesAllTokens(formatPct(val), String(text));
};
