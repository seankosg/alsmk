import { useCallback, useState } from "react";
import { parseMdrFile, isSummaryFilename, type MdrParseResult } from "@/lib/mdr/parser";
import { validateSheet, applyAutoFix } from "@/lib/mdr/validator";
import { persistParsed, logImport } from "@/lib/mdr/importRunner";
import { computeMatrix, saveSnapshot } from "@/lib/mdr/milestoneMonitorEngine";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ImportFileStatus =
  | "pending"
  | "parsing"
  | "ready"
  | "skipped"
  | "processing"
  | "done"
  | "failed";

export interface ImportFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: ImportFileStatus;
  parsed?: MdrParseResult;
  building?: string;
  sheetNames?: string[];
  parsedCount?: number;
  validationWarnings?: string[];
  skipReason?: string;
  error?: string;
  result?: { inserted: number; skipped: number };
}

let _uid = 0;
const uid = () => `f${Date.now()}-${++_uid}`;

export function useMdrImporter(onImported?: () => void) {
  const { user } = useAuth();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const update = useCallback((id: string, patch: Partial<ImportFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback(async (incoming: File[]) => {
    if (!incoming.length) return;
    const newOnes: ImportFile[] = incoming.map((file) => ({
      id: uid(),
      file,
      name: file.name,
      size: file.size,
      status: "parsing",
    }));
    setFiles((prev) => [...prev, ...newOnes]);

    for (const item of newOnes) {
      try {
        if (isSummaryFilename(item.file.name)) {
          update(item.id, {
            status: "skipped",
            skipReason: "SUMMARY 파일은 Raw Data에서 자동 계산되므로 임포트하지 않습니다.",
          });
          continue;
        }
        const parsed = await parseMdrFile(item.file);
        const warnings: string[] = [];
        let totalRows = 0;
        for (const sh of parsed.sheets) {
          if (sh.skipped) continue;
          totalRows += sh.rows.length;
          const rep = validateSheet(sh);
          if (!rep.ok) {
            for (const iss of rep.issues) {
              if (iss.canAutoFix) {
                applyAutoFix(sh, iss);
                warnings.push(`${sh.sheetName}/${iss.stage}: 합계 ${iss.actualSum}% → 자동 차분 적용`);
              } else {
                warnings.push(`${sh.sheetName}/${iss.stage}: 합계 ${iss.actualSum}% (Δ${iss.delta.toFixed(1)})`);
              }
            }
          }
        }
        update(item.id, {
          status: "ready",
          parsed,
          building: parsed.building,
          sheetNames: parsed.sheets.map((s) => s.sheetName),
          parsedCount: totalRows,
          validationWarnings: warnings,
        });
      } catch (e: any) {
        update(item.id, { status: "failed", error: e?.message ?? String(e) });
      }
    }
  }, [update]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    if (isRunning) return;
    setFiles([]);
  }, [isRunning]);

  const startImport = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      // snapshot ready files
      const targets = files.filter((f) => f.status === "ready" && f.parsed);
      for (const t of targets) {
        update(t.id, { status: "processing" });
        try {
          // Pre-create the import log to get an ID, then persist with row-level logs attached.
          const logId = await logImport({
            filename: t.parsed!.filename,
            building: t.parsed!.building,
            status: "success",
            inserted: 0,
            skipped: 0,
            userId: user?.id ?? null,
          });
          const res = await persistParsed(t.parsed!, undefined, logId, t.file);
          if (logId) {
            await (supabase as any).from("mdr_import_logs")
              .update({ rows_inserted: res.inserted, rows_skipped: res.skipped })
              .eq("id", logId);
          }
          update(t.id, { status: "done", result: res });
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          await logImport({
            filename: t.parsed!.filename,
            building: t.parsed!.building ?? null,
            status: "failed",
            inserted: 0,
            skipped: 0,
            userId: user?.id ?? null,
            errorSummary: msg,
          });
          update(t.id, { status: "failed", error: msg });
        }
      }
      onImported?.();
    } finally {
      setIsRunning(false);
    }
  }, [files, isRunning, onImported, update, user?.id]);

  const readyCount = files.filter((f) => f.status === "ready").length;

  return { files, isRunning, addFiles, removeFile, clearAll, startImport, readyCount };
}
