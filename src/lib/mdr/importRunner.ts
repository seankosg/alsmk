import { supabase } from "@/integrations/supabase/client";
import type { MdrParseResult } from "./parser";

export interface PersistResult {
  inserted: number;
  skipped: number;
}

/** Persist a parsed MDR file. Returns counts. SUMMARY 파일은 호출 전에 필터링되어야 함. */
export async function persistParsed(
  parsed: MdrParseResult,
  onLog?: (s: string) => void,
): Promise<PersistResult> {
  const push = onLog ?? (() => {});

  if (parsed.isSummary) return { inserted: 0, skipped: 0 };

  // 1) 건물 upsert
  const { error: bErr } = await supabase.from("mdr_buildings" as never).upsert(
    { code: parsed.building, name: parsed.building, sort_order: 0 } as any,
    { onConflict: "code" },
  );
  if (bErr) throw bErr;

  const allRows = parsed.sheets.flatMap((s) => (s.skipped ? [] : s.rows));
  const allItemNos = Array.from(new Set(allRows.map((r) => r.itemNo)));

  // 2) 기존 item_no 일괄 조회
  const existing = new Set<string>();
  for (let i = 0; i < allItemNos.length; i += 500) {
    const chunk = allItemNos.slice(i, i + 500);
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("item_no")
      .eq("building_code", parsed.building)
      .in("item_no", chunk);
    if (error) throw error;
    (data as any[] ?? []).forEach((d) => existing.add(d.item_no));
  }
  push(`  · 기존 도면 ${existing.size}건 — 보존`);

  // 3) 신규 행
  const seen = new Set<string>();
  const newRows = allRows.filter((r) => {
    if (existing.has(r.itemNo) || seen.has(r.itemNo)) return false;
    seen.add(r.itemNo);
    return true;
  });
  const skipped = allRows.length - newRows.length;

  // 4) drawings bulk insert
  const itemToId = new Map<string, string>();
  for (let i = 0; i < newRows.length; i += 200) {
    const chunk = newRows.slice(i, i + 200);
    const payload = chunk.map((row) => ({
      building_code: parsed.building,
      source_no: row.sourceNo,
      item_no: row.itemNo,
      discipline: row.discipline,
      job_no: row.jobNo ?? null,
      area_code: row.areaCode ?? null,
      function_code: row.functionCode ?? null,
      serial_no: row.serialNo ?? null,
      activity_group: row.activityGroup ?? null,
      drawing_title: row.drawingTitle ?? null,
      plan_finish: row.planFinish ?? null,
      out_of_scope: row.outOfScope,
      source_sheet: row.sourceSheet,
    }));
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .insert(payload as any)
      .select("id, item_no");
    if (error) throw error;
    (data as any[] ?? []).forEach((d) => itemToId.set(d.item_no, d.id));
  }

  // 5) milestones / progress bulk insert
  const milestonePayloads: any[] = [];
  const progressPayloads: any[] = [];
  for (const row of newRows) {
    const id = itemToId.get(row.itemNo);
    if (!id) continue;
    for (const m of row.milestones) {
      milestonePayloads.push({
        drawing_id: id, stage: m.stage, pct: m.pct,
        increment_pct: m.incrementPct, plan_date: m.planDate ?? null,
      });
    }
    for (const p of row.progress) {
      progressPayloads.push({
        drawing_id: id, stage: p.stage, pct: p.pct,
        is_done: p.stage === "SD" ? true : p.isDone,
      });
    }
  }
  for (let i = 0; i < milestonePayloads.length; i += 1000) {
    const chunk = milestonePayloads.slice(i, i + 1000);
    const { error } = await supabase.from("mdr_milestones" as never).insert(chunk as any);
    if (error && !error.message.includes("duplicate")) throw error;
  }
  for (let i = 0; i < progressPayloads.length; i += 1000) {
    const chunk = progressPayloads.slice(i, i + 1000);
    const { error } = await supabase.from("mdr_progress" as never).insert(chunk as any);
    if (error && !error.message.includes("duplicate")) throw error;
  }

  push(`  ✓ 신규 ${newRows.length}건 추가, 기존/중복 ${skipped}건 보존`);

  await supabase.from("mdr_snapshots" as never).insert({
    snapshot_date: new Date().toISOString().slice(0, 10),
    building_code: parsed.building,
    source_filename: parsed.filename,
    drawing_count: newRows.length + skipped,
    done_count: 0,
  } as any);

  return { inserted: newRows.length, skipped };
}

export async function logImport(opts: {
  filename: string;
  building: string | null;
  status: "success" | "failed";
  inserted: number;
  skipped: number;
  userId: string | null;
  errorSummary?: string | null;
}) {
  await supabase.from("mdr_import_logs" as never).insert({
    filename: opts.filename,
    building_code: opts.building,
    status: opts.status,
    rows_inserted: opts.inserted,
    rows_skipped: opts.skipped,
    error_summary: opts.errorSummary ?? null,
    imported_by: opts.userId,
  } as any);
}
