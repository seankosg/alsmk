export type RfiDirection = "Outgoing" | "Incoming" | "Unknown";
export type RfiEventType = "Send" | "Reply" | "Resend" | "Unknown";

export function classifyDirection(from: string | null, to: string | null): RfiDirection {
  const f = (from ?? "").toLowerCase();
  const t = (to ?? "").toLowerCase();
  if (/_to\b|_to\s/.test(t) || /_to\b|_to\s/.test(f)) return "Outgoing";
  if (/_from\b|_from\s/.test(f) || /_from\b|_from\s/.test(t)) return "Incoming";
  // Fallback: HDEC as From -> Outgoing
  if (f.includes("hdec") && !t.includes("hdec")) return "Outgoing";
  if (t.includes("hdec") && !f.includes("hdec")) return "Incoming";
  return "Unknown";
}

export function classifyEventType(title: string | null, dir: RfiDirection): RfiEventType {
  const isRe = /^\s*re\s*:/i.test(title ?? "");
  if (dir === "Outgoing") return isRe ? "Resend" : "Send";
  if (dir === "Incoming") return isRe ? "Reply" : "Reply";
  return "Unknown";
}

export function cleanTitle(title: string | null): string {
  if (!title) return "";
  let s = title.trim();
  // Remove leading RE: prefixes
  s = s.replace(/^(\s*re\s*:\s*)+/i, "");
  // Remove leading [rfi_no] bracket
  s = s.replace(/^\s*\[[^\]]+\]\s*/, "");
  return s.trim();
}
