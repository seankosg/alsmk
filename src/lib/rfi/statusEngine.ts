export type RfiStatus = "Overdue" | "DueSoon" | "OnTrack" | "Closed" | "LateClosed" | "Info";

export const STATUS_META: Record<RfiStatus, { label: string; cls: string; dot: string; weight: number }> = {
  Overdue:    { label: "Overdue",     cls: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",       dot: "bg-red-500",    weight: 0 },
  DueSoon:    { label: "Due Soon",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200", dot: "bg-amber-500",  weight: 1 },
  OnTrack:    { label: "On-track",    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200", dot: "bg-emerald-500", weight: 2 },
  LateClosed: { label: "Late-Closed", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200", dot: "bg-orange-500", weight: 3 },
  Closed:     { label: "Closed",      cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",   dot: "bg-slate-400",  weight: 4 },
  Info:       { label: "Info",        cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",     dot: "bg-blue-400",   weight: 5 },
};

export function daysOverdue(due: string | null, response: string | null, asOf: string): number | null {
  if (!due) return null;
  if (response) return null;
  const a = new Date(asOf + "T00:00:00");
  const b = new Date(due + "T00:00:00");
  const diff = Math.floor((a.getTime() - b.getTime()) / 86400_000);
  return diff > 0 ? diff : 0;
}

export function daysUntilDue(due: string | null, asOf: string): number | null {
  if (!due) return null;
  const a = new Date(asOf + "T00:00:00");
  const b = new Date(due + "T00:00:00");
  return Math.floor((b.getTime() - a.getTime()) / 86400_000);
}
