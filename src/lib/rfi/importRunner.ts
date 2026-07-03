import { supabase } from "@/integrations/supabase/client";
import { parseRfiFile, type RfiParseResult } from "./parser";
import { classifyDirection, classifyEventType, cleanTitle } from "./directionClassifier";
import { rowHash } from "./hash";

const BUCKET = "rfi-uploads";

export interface RfiImportResult {
  inserted: number;
  skipped: number;
  total: number;
  affectedRfiNos: string[];
  logId: string | null;
  storagePath: string | null;
}

async function replaceLatestUpload(file: File): Promise<string | null> {
  try {
    // list existing and remove all
    const { data: list } = await (supabase as any).storage.from(BUCKET).list("latest", { limit: 100 });
    if (list && list.length > 0) {
      await (supabase as any).storage
        .from(BUCKET)
        .remove(list.map((o: any) => `latest/${o.name}`));
    }
    const path = `latest/${file.name}`;
    const { error } = await (supabase as any).storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (error) {
      console.warn("RFI upload skipped:", error.message);
      return null;
    }
    return path;
  } catch (e: any) {
    console.warn("RFI upload skipped:", e?.message ?? e);
    return null;
  }
}

export async function importRfiFile(file: File, userId: string | null): Promise<RfiImportResult> {
  const parsed: RfiParseResult = await parseRfiFile(file);
  const storagePath = await replaceLatestUpload(file);

  // Create import log
  const { data: logRow, error: logErr } = await (supabase as any)
    .from("rfi_import_logs")
    .insert({
      filename: file.name,
      uploaded_by: userId,
      rows_total: parsed.rows.length,
      rows_inserted: 0,
      rows_skipped: 0,
      status: "success",
      storage_path: storagePath,
    })
    .select("id")
    .single();
  if (logErr) throw logErr;
  const logId = logRow.id as string;

  // Build event rows
  const events: any[] = [];
  for (const r of parsed.rows) {
    const dir = classifyDirection(r.from_party, r.to_party);
    const type = classifyEventType(r.title, dir);
    const hash = await rowHash(r.rfi_no, r.issue_date, r.from_party, r.to_party, r.title);
    events.push({
      rfi_no: r.rfi_no,
      raw_no: r.raw_no,
      raw_status: r.raw_status,
      from_party: r.from_party,
      to_party: r.to_party,
      direction: dir,
      event_type: type,
      title: r.title,
      title_clean: cleanTitle(r.title),
      discipline: r.discipline,
      originator: r.originator,
      issue_date: r.issue_date,
      due_date: r.due_date,
      finish_date: r.finish_date,
      import_log_id: logId,
      source_row_hash: hash,
      source_filename: file.name,
    });
  }

  // Upsert on source_row_hash
  let inserted = 0;
  let skipped = 0;
  const batchSize = 200;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    // Detect existing hashes
    const hashes = batch.map((e) => e.source_row_hash);
    const { data: existing } = await (supabase as any)
      .from("rfi_events")
      .select("source_row_hash")
      .in("source_row_hash", hashes);
    const exSet = new Set((existing ?? []).map((r: any) => r.source_row_hash));
    const toInsert = batch.filter((e) => !exSet.has(e.source_row_hash));
    skipped += batch.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error: insErr } = await (supabase as any).from("rfi_events").insert(toInsert);
      if (insErr) throw insErr;
      inserted += toInsert.length;
    }
  }

  // Recompute masters for affected rfi_nos
  const affected = Array.from(new Set(events.map((e) => e.rfi_no)));
  for (const no of affected) {
    await (supabase as any).rpc("recompute_rfi_master", { _rfi_no: no });
  }

  // Update log counts
  await (supabase as any)
    .from("rfi_import_logs")
    .update({ rows_inserted: inserted, rows_skipped: skipped })
    .eq("id", logId);

  return { inserted, skipped, total: events.length, affectedRfiNos: affected, logId, storagePath };
}
