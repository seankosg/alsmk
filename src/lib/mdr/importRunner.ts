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
  doc_base: string | null;
  action: "inserted" | "skipped_duplicate" | "skipped_existing" | "rev_updated";
  reason: string | null;
}

/** Persist a parsed MDR file. 매칭 키는 (building_code, doc_base). SUMMARY 파일은 호출 전에 필터링. */
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

  // 2) 기존 도면 조회 — (building_code, doc_base) 매칭
  type ExistingDrawing = {
    id: string; item_no: string | null; doc_base: string; rev: string | null;
    drawing_title: string | null; plan_finish: string | null; actual_finish: string | null;
    out_of_scope: boolean | null; source_sheet: string | null;
  };
  const existingByDocBase = new Map<string, ExistingDrawing>();

  const allDocBases = Array.from(new Set(allRows.map((r) => r.docBase)));

  for (let i = 0; i < allDocBases.length; i += 500) {
    const chunk = allDocBases.slice(i, i + 500);
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .select("id, item_no, doc_base, rev, drawing_title, plan_finish, actual_finish, out_of_scope, source_sheet")
      .eq("building_code", parsed.building)
      .in("doc_base", chunk);
    if (error) throw error;
    for (const d of (data as any[]) ?? []) {
      if (d.doc_base) existingByDocBase.set(d.doc_base as string, d as ExistingDrawing);
    }
  }

  push(`  · 기존 도면 ${existingByDocBase.size}건 — (building, doc_base) 매칭`);

  // 3) 분류: 신규 / 동일 Rev(스킵) / Rev 변경(이력 보관 후 갱신) / 파일 내 중복
  interface RowPlan {
    row: MdrParsedRow;
    action: "insert" | "skip_same_rev" | "rev_update" | "dup_in_file";
    existing?: ExistingDrawing;
  }
  const rowLogs: RowLogEntry[] = [];
  const seenDocBase = new Set<string>();
  const plans: RowPlan[] = [];

  const baseLog = (r: MdrParsedRow) => ({
    source_sheet: r.sourceSheet,
    raw_row_no: r.rawRowNo,
    item_no: r.itemNo,
    source_no: r.sourceNo,
    drawing_title: r.drawingTitle ?? null,
    doc_base: r.docBase,
  });

  for (const r of allRows) {
    const existing = existingByDocBase.get(r.docBase);

    if (seenDocBase.has(r.docBase)) {
      plans.push({ row: r, action: "dup_in_file" });
      rowLogs.push({
        ...baseLog(r),
        action: "skipped_duplicate",
        reason: "파일 내 중복 (Doc No.)",
      });
      continue;
    }
    seenDocBase.add(r.docBase);

    if (!existing) {
      plans.push({ row: r, action: "insert" });
      rowLogs.push({ ...baseLog(r), action: "inserted", reason: null });
    } else if ((existing.rev ?? "0") === r.rev) {
      plans.push({ row: r, action: "skip_same_rev", existing });
      rowLogs.push({
        ...baseLog(r),
        action: "skipped_existing",
        reason: `이미 존재 (Rev ${existing.rev ?? "0"})`,
      });
    } else {
      plans.push({ row: r, action: "rev_update", existing });
      rowLogs.push({
        ...baseLog(r),
        action: "rev_updated",
        reason: `Rev ${existing.rev ?? "0"} → ${r.rev}`,
      });
    }
  }

  const newRows = plans.filter((p) => p.action === "insert").map((p) => p.row);
  const revUpdates = plans.filter((p) => p.action === "rev_update");
  const skipped = plans.filter((p) => p.action === "skip_same_rev" || p.action === "dup_in_file").length;

  // 4-a) Rev 변경: 기존 진행률 스냅샷
  if (revUpdates.length) {
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
        doc_no: `${ex.doc_base}-${ex.rev ?? "0"}`,
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

    // 기존 도면 행 갱신 + 마일스톤/진행률 초기화
    for (const p of revUpdates) {
      const ex = p.existing!;
      const r = p.row;
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
          doc_base: r.docBase,
          doc_no: `${r.docBase}-${r.rev}`,
          activity_group: r.activityGroup ?? null,
          drawing_title: r.drawingTitle ?? null,
          plan_finish: r.planFinish ?? null,
          out_of_scope: r.outOfScope,
          in_scope_sd: r.inScope.sd,
          in_scope_dd: r.inScope.dd,
          in_scope_cd: r.inScope.cd,
          missing_plant_id: r.missingTokens.plantId,
          missing_pbs: r.missingTokens.pbs,
          missing_fbs: r.missingTokens.fbs,
          missing_ser_no: r.missingTokens.serNo,
          confirmed_by: r.confirmedBy ?? null,
          ifr_start_date: r.ifrStartDate ?? null,
          ifr_issue_date: r.ifrIssueDate ?? null,
          ifc_start_date: r.ifcStartDate ?? null,
          ifc_issue_date: r.ifcIssueDate ?? null,
          document_class: r.documentClass ?? null,
          doc_class_code: r.docClassCode ?? null,
          stage_plan_sd: r.stagePlanSd ?? null,
          stage_plan_dd: r.stagePlanDd ?? null,
          stage_plan_cd: r.stagePlanCd ?? null,
          source_sheet: r.sourceSheet,
          import_log_id: importLogId ?? null,
        } as any)
        .eq("id", ex.id);
      if (uErr) throw uErr;
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

  // 4-b) 신규 행 bulk insert. UNIQUE(building, doc_base) 위반 발생 시 행 단위로 재시도하여 충돌만 로그 처리.
  const docBaseToId = new Map<string, string>();
  const insertSingles: MdrParsedRow[] = [];
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
      doc_base: row.docBase,
      doc_no: `${row.docBase}-${row.rev}`,
      activity_group: row.activityGroup ?? null,
      drawing_title: row.drawingTitle ?? null,
      plan_finish: row.planFinish ?? null,
      out_of_scope: row.outOfScope,
      in_scope_sd: row.inScope.sd,
      in_scope_dd: row.inScope.dd,
      in_scope_cd: row.inScope.cd,
      missing_plant_id: row.missingTokens.plantId,
      missing_pbs: row.missingTokens.pbs,
      missing_fbs: row.missingTokens.fbs,
      missing_ser_no: row.missingTokens.serNo,
      confirmed_by: row.confirmedBy ?? null,
      ifr_start_date: row.ifrStartDate ?? null,
      ifr_issue_date: row.ifrIssueDate ?? null,
      ifc_start_date: row.ifcStartDate ?? null,
      ifc_issue_date: row.ifcIssueDate ?? null,
      document_class: row.documentClass ?? null,
      doc_class_code: row.docClassCode ?? null,
      stage_plan_sd: row.stagePlanSd ?? null,
      stage_plan_dd: row.stagePlanDd ?? null,
      stage_plan_cd: row.stagePlanCd ?? null,
      source_sheet: row.sourceSheet,
      import_log_id: importLogId ?? null,
    }));
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .insert(payload as any)
      .select("id, doc_base");
    if (error) {
      // 충돌 시 단건 재시도 fallback
      insertSingles.push(...chunk);
    } else {
      (data as any[] ?? []).forEach((d) => docBaseToId.set(d.doc_base, d.id));
    }
  }

  // 단건 재시도: 실패한 행은 rowLogs 충돌로 기록
  for (const row of insertSingles) {
    const payload = {
      building_code: parsed.building,
      source_no: row.sourceNo, item_no: row.itemNo, discipline: row.discipline,
      plant_id: row.plantId ?? null, pbs: row.pbs ?? null, fbs: row.fbs ?? null, ser_no: row.serNo ?? null,
      rev: row.rev, doc_base: row.docBase, doc_no: `${row.docBase}-${row.rev}`,
      activity_group: row.activityGroup ?? null, drawing_title: row.drawingTitle ?? null,
      plan_finish: row.planFinish ?? null, out_of_scope: row.outOfScope,
      in_scope_sd: row.inScope.sd, in_scope_dd: row.inScope.dd, in_scope_cd: row.inScope.cd,
      missing_plant_id: row.missingTokens.plantId, missing_pbs: row.missingTokens.pbs,
      missing_fbs: row.missingTokens.fbs, missing_ser_no: row.missingTokens.serNo,
      source_sheet: row.sourceSheet, import_log_id: importLogId ?? null,
    };
    const { data, error } = await supabase
      .from("mdr_drawings" as never)
      .insert(payload as any)
      .select("id, doc_base");
    if (error) {
      const idx = rowLogs.findIndex((l) =>
        l.action === "inserted" && l.doc_base === row.docBase && l.source_sheet === row.sourceSheet && l.raw_row_no === row.rawRowNo,
      );
      if (idx >= 0) {
        rowLogs[idx].action = "skipped_existing";
        rowLogs[idx].reason = `doc_base 중복 (${row.docBase})`;
      }
    } else {
      (data as any[] ?? []).forEach((d) => docBaseToId.set(d.doc_base, d.id));
    }
  }

  // 5) 신규 행 milestones / progress bulk insert
  const milestonePayloads: any[] = [];
  const progressPayloads: any[] = [];
  for (const row of newRows) {
    const id = docBaseToId.get(row.docBase);
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

  // 5.5) skip_same_rev 도면 재동기화
  const skipSameRevPlans = plans.filter((p) => p.action === "skip_same_rev");
  let resynced = 0;
  if (skipSameRevPlans.length) {
    const ids = skipSameRevPlans.map((p) => p.existing!.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const [{ error: mErr }, { error: pErr }] = await Promise.all([
        (supabase.from("mdr_milestones" as never) as any).delete().in("drawing_id", chunk),
        (supabase.from("mdr_progress" as never) as any).delete().in("drawing_id", chunk),
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;
    }
    for (const p of skipSameRevPlans) {
      const ex = p.existing!;
      const r = p.row;
      await (supabase.from("mdr_drawings" as never) as any)
        .update({
          in_scope_sd: r.inScope.sd,
          in_scope_dd: r.inScope.dd,
          in_scope_cd: r.inScope.cd,
          missing_plant_id: r.missingTokens.plantId,
          missing_pbs: r.missingTokens.pbs,
          missing_fbs: r.missingTokens.fbs,
          missing_ser_no: r.missingTokens.serNo,
          out_of_scope: r.outOfScope,
          plan_finish: r.planFinish ?? null,
          source_sheet: r.sourceSheet,
          item_no: r.itemNo,
        } as any)
        .eq("id", ex.id);
    }
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
