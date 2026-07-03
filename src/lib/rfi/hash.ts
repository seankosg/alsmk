export async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function rowHash(rfi_no: string, issue_date: string | null, from: string | null, to: string | null, title: string | null): Promise<string> {
  return sha1Hex([rfi_no, issue_date ?? "", from ?? "", to ?? "", title ?? ""].join("|"));
}
