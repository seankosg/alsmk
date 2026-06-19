import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { parseMdrFile, type MdrParseResult } from "@/lib/mdr/parser";
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
        const parsed = await parseMdrFile(file);
        push(`  건물: ${parsed.building} (시트 ${parsed.sheets.length}개${parsed.isSummary ? ", SUMMARY" : ""})`);

        // 검증
        let allOk = true;
        for (const sh of parsed.sheets) {
          if (sh.skipped) { push(`  ⊘ ${sh.sheetName}: ${sh.skipReason}`); continue; }
          const rep = validateSheet(sh);
          if (!rep.ok) {
            allOk = false;
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

        // 저장
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
    // SUMMARY 파일 — 가중치 참고값 시드 (단순 처리: 모든 building·discipline·stage = 1.0)
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

  let inserted = 0;
  let skipped = 0;

  for (const sheet of parsed.sheets) {
    if (sheet.skipped) continue;
    for (const row of sheet.rows) {
      // 기존 도면이 있으면 INSERT 스킵 (앱이 마스터 — 신규만 추가, 기존 Y 보존)
      const { data: existing } = await supabase
        .from("mdr_drawings" as never)
        .select("id")
        .eq("building_code", parsed.building)
        .eq("item_no", row.itemNo)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const { data: drawing, error: dErr } = await supabase
        .from("mdr_drawings" as never)
        .insert({
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
        } as any)
        .select("id")
        .single();
      if (dErr) throw dErr;
      const drawingId = (drawing as any).id;

      // 마일스톤·진척 INSERT (중복 무시)
      const ms = row.milestones.map((m) => ({
        drawing_id: drawingId,
        stage: m.stage,
        pct: m.pct,
        increment_pct: m.incrementPct,
        plan_date: m.planDate ?? null,
      }));
      if (ms.length) {
        const { error: mErr } = await supabase.from("mdr_milestones" as never).insert(ms as any);
        if (mErr && !mErr.message.includes("duplicate")) throw mErr;
      }
      const pg = row.progress.map((p) => ({
        drawing_id: drawingId,
        stage: p.stage,
        pct: p.pct,
        is_done: p.stage === "SD" ? true : p.isDone,
      }));
      if (pg.length) {
        const { error: pErr } = await supabase.from("mdr_progress" as never).insert(pg as any);
        if (pErr && !pErr.message.includes("duplicate")) throw pErr;
      }
      inserted++;
    }
  }

  push(`  ✓ 신규 ${inserted}건 추가, 기존 ${skipped}건 보존`);

  // 스냅샷 (template_blob은 base64로 저장하기엔 큼 — 단순 메타만 저장)
  await supabase.from("mdr_snapshots" as never).insert({
    snapshot_date: new Date().toISOString().slice(0, 10),
    building_code: parsed.building,
    source_filename: parsed.filename,
    drawing_count: inserted + skipped,
    done_count: 0,
  } as any);

  await logImport(parsed.filename, parsed.building, "success", inserted, skipped, userId, null);
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
