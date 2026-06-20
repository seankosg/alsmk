import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { parseMdrFile, type MdrParseResult, isSummaryFilename } from "@/lib/mdr/parser";
import { parseSummaryFile, type SummaryParseResult } from "@/lib/mdr/summaryParser";
import { validateSheet, applyAutoFix } from "@/lib/mdr/validator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}

export function MdrImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const push = (s: string) => setLog((p) => [...p, s]);

  async function handleImport() {
    if (!files.length) {
      toast.error("파일을 선택하세요");
      return;
    }
    setBusy(true);
    setProgress(0);
    setLog([]);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        push(`📂 ${file.name} 파싱 중...`);

        if (isSummaryFilename(file.name)) {
          const sum = await parseSummaryFile(file);
          push(`  SUMMARY: 가중치 ${sum.weights.length}건, 매트릭스 ${sum.matrix.length}건`);
          await persistSummary(sum, push);
          setProgress(((i + 1) / files.length) * 100);
          continue;
        }

        const parsed = await parseMdrFile(file);
        push(`  건물: ${parsed.building} (시트 ${parsed.sheets.length}개)`);

        // 검증
        for (const sh of parsed.sheets) {
          if (sh.skipped) { push(`  ⊘ ${sh.sheetName}: ${sh.skipReason}`); continue; }
          const rep = validateSheet(sh);
          if (!rep.ok) {
            for (const iss of rep.issues) {
              if (iss.canAutoFix) {
                push(`  ⚙ ${sh.sheetName}/${iss.stage}: 합계 ${iss.actualSum}% — 누계로 판단, 자동 차분 적용`);
                applyAutoFix(sh, iss);
              } else {
                push(`  ⚠ ${sh.sheetName}/${iss.stage}: 합계 ${iss.actualSum}% (Δ${iss.delta.toFixed(1)}) — 그대로 진행`);
              }
            }
          }
        }

        await persistParsed(parsed, user?.id ?? null, push);
        setProgress(((i + 1) / files.length) * 100);
      }
      toast.success("임포트 완료");
      onImported?.();
    } catch (e: any) {
      console.error(e);
      toast.error(`임포트 실패: ${e.message ?? e}`);
      push(`❌ 실패: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>MDR 엑셀 임포트</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".xlsx,.xls"
            multiple
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <Alert>
              <AlertDescription>{files.length}개 파일 선택됨. SUMMARY(00_...) 포함 시 가중치 참고값으로 시드됩니다.</AlertDescription>
            </Alert>
          )}
          {busy && <Progress value={progress} />}
          {log.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs space-y-0.5">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>닫기</Button>
          <Button disabled={busy || !files.length} onClick={handleImport}>임포트 시작</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function persistParsed(parsed: MdrParseResult, userId: string | null, push: (s: string) => void) {
  if (parsed.isSummary) {
    push(`  ✓ SUMMARY 임포트는 Phase 1 기본 시드만 적용`);
    await logImport(parsed.filename, null, "success", 0, 0, userId, null);
    return;
  }

  // 1) 건물 upsert
  const { error: bErr } = await supabase.from("mdr_buildings" as never).upsert(
    { code: parsed.building, name: parsed.building, sort_order: 0 } as any,
    { onConflict: "code" },
  );
  if (bErr) throw bErr;

  // 모든 후보 행 수집
  const allRows = parsed.sheets.flatMap((s) => (s.skipped ? [] : s.rows));
  const allItemNos = Array.from(new Set(allRows.map((r) => r.itemNo)));

  // 2) 기존 item_no 일괄 조회 (chunk in())
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

  // 3) 신규 행만 추출 (itemNo 중복 제거)
  const seen = new Set<string>();
  const newRows = allRows.filter((r) => {
    if (existing.has(r.itemNo) || seen.has(r.itemNo)) return false;
    seen.add(r.itemNo);
    return true;
  });
  const skipped = allRows.length - newRows.length;

  // 4) drawings bulk insert (chunk 200) — returning id, item_no
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
    push(`  · drawings ${Math.min(i + 200, newRows.length)}/${newRows.length} 삽입`);
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

  await logImport(parsed.filename, parsed.building, "success", newRows.length, skipped, userId, null);
}

async function logImport(
  filename: string,
  building: string | null,
  status: string,
  inserted: number,
  skipped: number,
  userId: string | null,
  errorSummary: string | null,
) {
  await supabase.from("mdr_import_logs" as never).insert({
    filename,
    building_code: building,
    status,
    rows_inserted: inserted,
    rows_skipped: skipped,
    error_summary: errorSummary,
    imported_by: userId,
  } as any);
}
