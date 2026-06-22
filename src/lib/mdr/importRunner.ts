import { supabase } from "@/integrations/supabase/client";
import type { MdrParseResult, MdrParsedRow } from "./parser";

export interface PersistResult {
  inserted: number;
  skipped: number;
  revUpdated: number;
}

interface RowLogEntry {
  source_sheet: string | null;
  raw_row_no: number | null;
  item_no: string | null;
  source_no: string | null;
  drawing_title: string | null;
  action: "inserted" | "skipped_duplicate" | "skipped_existing" | "rev_updated";
  reason: string | null;
}

/** Persist a parsed MDR file. Returns counts. SUMMARY 파일은 호출 전에 필터링되어야 함. */
export async function persistParsed(
  parsed: MdrParseResult,
  onLog?: (s: string) => void,
  importLogId?: string | null,
): Promise<PersistResult> {
  const push = onLog ?? (() => {});

  if (parsed.isSummary) return { inserted: 0, skipped: 0, revUpdated: 0 };

  // 1) 건물 upsert
  const { error: bErr } = await supabase.from("mdr_buildings" as never).upsert(
    { code: parsed.building, name: parsed.building, sort_order: 0 } as any,
    { onConflict: "code" },
  );
  if (bErr) throw bErr;

  const allRows = parsed.sheets.flatMap((s) => (s.skipped ? [] : s.rows));

  // 2) 기존 도면 조회 — item_no 기반 단일 인덱스 (docBase는 표시용)
  type ExistingDrawing = {
    id: string; item_no: string; doc_base: string | null; rev: string | null;
    drawing_title: string | null; plan_finish: string | null; actual_finish: string | null;
    out_of_scope: boolean | null; source_sheet: string | null;
  };
  const existingByItemNo = new Map<string, ExistingDrawing>();

  const allItemNos = Array.from(new Set(allRows.map((r) => r.itemNo)));

  const fetchExisting = async (col: "item_no", values: string[]) => {
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500);
      const { data, error } = await supabase
        .from("mdr_drawings" as never)
        .select("id, item_no, doc_base, rev, drawing_title, plan_finish, actual_finish, out_of_scope, source_sheet")
        .eq("building_code", parsed.building)
        .in(col, chunk);
      if (error) throw error;
      for (const d of (data as any[]) ?? []) {
        if (d.item_no) existingByItemNo.set(d.item_no as string, d as ExistingDrawing);
      }
    }
  };
  if (allItemNos.length) await fetchExisting("item_no", allItemNos);

  push(`  · 기존 도면 ${existingByItemNo.size}건 — 매칭 시도`);

  // 3) 분류: 신규 / 동일 Rev(스킵) / Rev 변경(이력 보관 후 갱신) / 파일 내 중복
  interface RowPlan {
    row: MdrParsedRow;
    action: "insert" | "skip_same_rev" | "rev_update" | "dup_in_file";
    existing?: ExistingDrawing;
  }
  const rowLogs: RowLogEntry[] = [];
  const seenItemNo = new Set<string>();
  const plans: RowPlan[] = [];

  for (const r of allRows) {
    const existing = existingByItemNo.get(r.itemNo);

    // 파일 내 중복: itemNo 기준
    if (seenItemNo.has(r.itemNo)) {
      plans.push({ row: r, action: "dup_in_file" });
      rowLogs.push({
        source_sheet: r.sourceSheet, raw_row_no: r.rawRowNo,
        item_no: r.itemNo, source_no: r.sourceNo, drawing_title: r.drawingTitle ?? null,
        action: "skipped_duplicate",
        reason: "파일 내 중복 (Item No.)",
      });
      continue;
    }
    seenItemNo.add(r.itemNo);

    if (!existing) {
      plans.push({ row: r, action: "insert" });
      rowLogs.push({
        source_sheet: r.sourceSheet, raw_row_no: r.rawRowNo,
        item_no: r.itemNo, source_no: r.sourceNo, drawing_title: r.drawingTitle ?? null,
        action: "inserted", reason: null,
      });
    } else if ((existing.rev ?? "0") === r.rev) {
      plans.push({ row: r, action: "skip_same_rev", existing });
      rowLogs.push({
        source_sheet: r.sourceSheet, raw_row_no: r.rawRowNo,
        item_no: r.itemNo, source_no: r.sourceNo, drawing_title: r.drawingTitle ?? null,
        action: "skipped_existing", reason: `이미 존재 (Rev ${existing.rev ?? "0"})`,
      });
    } else {
      plans.push({ row: r, action: "rev_update", existing });
      rowLogs.push({
        source_sheet: r.sourceSheet, raw_row_no: r.rawRowNo,
        item_no: r.itemNo, source_no: r.sourceNo, drawing_title: r.drawingTitle ?? null,
        action: "rev_updated", reason: `Rev ${existing.rev ?? "0"} → ${r.rev}`,
      });
    }
  }

  const newRows = plans.filter((p) => p.action === "insert").map((p) => p.row);
  const revUpdates = plans.filter((p) => p.action === "rev_update");
  const skipped = plans.filter((p) => p.action === "skip_same_rev" || p.action === "dup_in_file").length;

  // 4-a) Rev 변경: 기존 진행률 스냅샷 후 이력 테이블 기록
  if (revUpdates.length) {
    // 기존 milestones/progress를 한 번에 조회
    const ids = revUpdates.map((p) => p.existing!.id);
    const [{ data: msData }, { data: pgData }] = await Promise.all([
      supabase.from("mdr_milestones" as never).select("*").in("drawing_id", ids),
      supabase.from("mdr_progress" as never).select("*").in("drawing_id", ids),
    ]);
    const msByDrawing = new Map<string, any[]>();
    const pgByDrawing = new Map<string, any[]>();
    for (const m of (msData as any[]) ?? []) {
      const arr = msByDrawing.get(m.drawing_id) ?? [];
      arr.push(m); msByDrawing.set(m.drawing_id, arr);
    }
    for (const p of (pgData as any[]) ?? []) {
      const arr = pgByDrawing.get(p.drawing_id) ?? [];
      arr.push(p); pgByDrawing.set(p.drawing_id, arr);
    }

    const revPayload = revUpdates.map((p) => {
      const ex = p.existing!;
      return {
        drawing_id: ex.id,
        building_code: parsed.building,
        doc_base: ex.doc_base,
        doc_no: ex.doc_base ? `${ex.doc_base}-${ex.rev ?? "0"}` : null,
        rev: ex.rev ?? "0",
        drawing_title: ex.drawing_title,
        plan_finish: ex.plan_finish,
        actual_finish: ex.actual_finish,
        out_of_scope: ex.out_of_scope ?? false,
        progress_snapshot: {
          milestones: msByDrawing.get(ex.id) ?? [],
          progress: pgByDrawing.get(ex.id) ?? [],
        },
        source_sheet: ex.source_sheet,
        import_log_id: importLogId ?? null,
        superseded_by_rev: p.row.rev,
      };
    });
    for (let i = 0; i < revPayload.length; i += 200) {
      const { error } = await supabase
        .from("mdr_drawing_revisions" as never)
        .insert(revPayload.slice(i, i + 200) as any);
      if (error) throw error;
    }

    // 기존 도면 행 갱신 + 마일스톤/진행률 초기화 (새 Rev 데이터로 교체)
    for (const p of revUpdates) {
      const ex = p.existing!;
      const r = p.row;
      const docNo = r.docBase ? `${r.docBase}-${r.rev}` : null;
      const { error: uErr } = await (supabase
        .from("mdr_drawings" as never) as any)
        .update({
          source_no: r.sourceNo,
          item_no: r.itemNo,
          discipline: r.discipline,
          plant_id: r.plantId ?? null,
          pbs: r.pbs ?? null,
          fbs: r.fbs ?? null,
          ser_no: r.serNo ?? null,
          rev: r.rev,
          doc_base: r.docBase ?? null,
          doc_no: docNo,
          activity_group: r.activityGroup ?? null,
          drawing_title: r.drawingTitle ?? null,
          plan_finish: r.planFinish ?? null,
          out_of_scope: r.outOfScope,
          in_scope_sd: r.inScope.sd,
          in_scope_dd: r.inScope.dd,
          in_scope_cd: r.inScope.cd,
          source_sheet: r.sourceSheet,
          import_log_id: importLogId ?? null,
        } as any)
        .eq("id", ex.id);
      if (uErr) throw uErr;
      // 기존 마일스톤/진행률 삭제 후 재삽입
      await (supabase.from("mdr_milestones" as never) as any).delete().eq("drawing_id", ex.id);
      await (supabase.from("mdr_progress" as never) as any).delete().eq("drawing_id", ex.id);
      const msIns = r.milestones.map((m) => ({
        drawing_id: ex.id, stage: m.stage, pct: m.pct,
        increment_pct: m.incrementPct, plan_date: m.planDate ?? null,
      }));
      const pgIns = r.progress.map((pr) => ({
        drawing_id: ex.id, stage: pr.stage, pct: pr.pct,
        is_done: pr.stage === "SD" ? true : pr.isDone,
      }));
      if (msIns.length) await supabase.from("mdr_milestones" as never).insert(msIns as any);
      if (pgIns.length) await supabase.from("mdr_progress" as never).insert(pgIns as any);
    }
  }

  // 4-b) 신규 행 bulk insert
  const itemToId = new Map<string, string>();
  for (let i = 0; i < newRows.length; i += 200) {
    const chunk = newRows.slice(i, i + 200);
    const payload = chunk.map((row) => ({
      building_code: parsed.building,
      source_no: row.sourceNo,
      item_no: row.itemNo,
      discipline: row.discipline,
      plant_id: row.plantId ?? null,
      pbs: row.pbs ?? null,
      fbs: row.fbs ?? null,
      ser_no: row.serNo ?? null,
      rev: row.rev,
      doc_base: row.docBase ?? null,
      doc_no: row.docBase ? `${row.docBase}-${row.rev}` : null,
      activity_group: row.activityGroup ?? null,
      drawing_title: row.drawingTitle ?? null,
      plan_finish: row.planFinish ?? null,
      out_of_scope: row.outOfScope,
      in_scope_sd: row.inScope.sd,
      in_scope_dd: row.inScope.dd,
      in_scope_cd: row.inScope.cd,
      source_sheet: row.sourceSheet,
      import_log_id: importLogId ?? null,
    }));
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .insert(payload as any)
      .select("id, item_no");
    if (error) throw error;
    (data as any[] ?? []).forEach((d) => itemToId.set(d.item_no, d.id));
  }

  // 5) 신규 행 milestones / progress bulk insert
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

  // 5.5) skip_same_rev 도면도 milestone/progress를 재동기화 (멱등성 보장 + 과거 누락분 백필)
  const skipSameRevPlans = plans.filter((p) => p.action === "skip_same_rev");
  let resynced = 0;
  if (skipSameRevPlans.length) {
    const ids = skipSameRevPlans.map((p) => p.existing!.id);
    // 기존 milestone/progress 일괄 삭제
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const [{ error: mErr }, { error: pErr }] = await Promise.all([
        (supabase.from("mdr_milestones" as never) as any).delete().in("drawing_id", chunk),
        (supabase.from("mdr_progress" as never) as any).delete().in("drawing_id", chunk),
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;
    }
    // in_scope_* / out_of_scope / plan_finish 같은 셀 단위 필드도 재임포트로 백필.
    for (const p of skipSameRevPlans) {
      const ex = p.existing!;
      const r = p.row;
      await (supabase.from("mdr_drawings" as never) as any)
        .update({
          in_scope_sd: r.inScope.sd,
          in_scope_dd: r.inScope.dd,
          in_scope_cd: r.inScope.cd,
          out_of_scope: r.outOfScope,
          plan_finish: r.planFinish ?? null,
          source_sheet: r.sourceSheet,
        } as any)
        .eq("id", ex.id);
    }
    // 새 파싱 결과로 재삽입
    const msResync: any[] = [];
    const pgResync: any[] = [];
    for (const p of skipSameRevPlans) {
      const id = p.existing!.id;
      const r = p.row;
      for (const m of r.milestones) {
        msResync.push({
          drawing_id: id, stage: m.stage, pct: m.pct,
          increment_pct: m.incrementPct, plan_date: m.planDate ?? null,
        });
      }
      for (const pr of r.progress) {
        pgResync.push({
          drawing_id: id, stage: pr.stage, pct: pr.pct,
          is_done: pr.stage === "SD" ? true : pr.isDone,
        });
      }
    }
    for (let i = 0; i < msResync.length; i += 1000) {
      const chunk = msResync.slice(i, i + 1000);
      const { error } = await supabase.from("mdr_milestones" as never).insert(chunk as any);
      if (error && !error.message.includes("duplicate")) throw error;
    }
    for (let i = 0; i < pgResync.length; i += 1000) {
      const chunk = pgResync.slice(i, i + 1000);
      const { error } = await supabase.from("mdr_progress" as never).insert(chunk as any);
      if (error && !error.message.includes("duplicate")) throw error;
    }
    resynced = skipSameRevPlans.length;
  }

  push(`  ✓ 신규 ${newRows.length}건, Rev 갱신 ${revUpdates.length}건, 보존 ${skipped}건 (재동기화 ${resynced}건)`);

  await supabase.from("mdr_snapshots" as never).insert({
    snapshot_date: new Date().toISOString().slice(0, 10),
    building_code: parsed.building,
    source_filename: parsed.filename,
    drawing_count: newRows.length + revUpdates.length + skipped,
    done_count: 0,
  } as any);

  // 6) 행별 로그 저장
  if (importLogId && rowLogs.length) {
    const payload = rowLogs.map((r) => ({ ...r, import_log_id: importLogId }));
    for (let i = 0; i < payload.length; i += 500) {
      const chunk = payload.slice(i, i + 500);
      const { error } = await supabase.from("mdr_import_row_logs" as never).insert(chunk as any);
      if (error) console.error("[mdr] row logs insert failed", error);
    }
  }

  return { inserted: newRows.length, skipped, revUpdated: revUpdates.length };
}

export async function logImport(opts: {
  filename: string;
  building: string | null;
  status: "success" | "failed";
  inserted: number;
  skipped: number;
  userId: string | null;
  errorSummary?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase.from("mdr_import_logs" as never).insert({
    filename: opts.filename,
    building_code: opts.building,
    status: opts.status,
    rows_inserted: opts.inserted,
    rows_skipped: opts.skipped,
    error_summary: opts.errorSummary ?? null,
    imported_by: opts.userId,
  } as any).select("id").single();
  if (error) {
    console.error("[mdr] logImport failed", error);
    return null;
  }
  return (data as any)?.id ?? null;
}
