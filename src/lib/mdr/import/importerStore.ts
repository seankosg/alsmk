/**
 * MDR Import 상태 싱글톤 store.
 * 라우트 이동 후 재방문 시에도 진행/완료 카드가 유지되도록
 * 컴포넌트 로컬 useState 대신 모듈 레벨에서 상태를 보관한다.
 *
 * 새로고침(F5) 시에는 File 객체가 직렬화 불가이므로 자연 초기화.
 */
import { parseMdrFile, isSummaryFilename, type MdrParseResult } from "@/lib/mdr/parser";
import { validateSheet, applyAutoFix } from "@/lib/mdr/validator";
import { persistParsed, logImport } from "@/lib/mdr/importRunner";
import { computeMatrix, saveSnapshot } from "@/lib/mdr/milestoneMonitorEngine";
import { supabase } from "@/integrations/supabase/client";
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

export interface ImporterState {
  files: ImportFile[];
  isRunning: boolean;
}

type Listener = () => void;

let state: ImporterState = { files: [], isRunning: false };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<ImporterState>) {
  state = { ...state, ...patch };
  emit();
}

function patchFile(id: string, patch: Partial<ImportFile>) {
  state = {
    ...state,
    files: state.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  };
  emit();
}

let _uid = 0;
const uid = () => `f${Date.now()}-${++_uid}`;

export const importerStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState(): ImporterState {
    return state;
  },

  async addFiles(incoming: File[]) {
    if (!incoming.length) return;
    const newOnes: ImportFile[] = incoming.map((file) => ({
      id: uid(),
      file,
      name: file.name,
      size: file.size,
      status: "parsing",
    }));
    setState({ files: [...state.files, ...newOnes] });

    for (const item of newOnes) {
      try {
        if (isSummaryFilename(item.file.name)) {
          patchFile(item.id, {
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
        patchFile(item.id, {
          status: "ready",
          parsed,
          building: parsed.building,
          sheetNames: parsed.sheets.map((s) => s.sheetName),
          parsedCount: totalRows,
          validationWarnings: warnings,
        });
      } catch (e: any) {
        patchFile(item.id, { status: "failed", error: e?.message ?? String(e) });
      }
    }
  },

  removeFile(id: string) {
    setState({ files: state.files.filter((f) => f.id !== id) });
  },

  clearAll() {
    if (state.isRunning) return;
    setState({ files: [] });
  },

  async startImport(opts: { userId: string | null; onImported?: () => void }) {
    if (state.isRunning) return;
    setState({ isRunning: true });
    try {
      const targets = state.files.filter((f) => f.status === "ready" && f.parsed);
      for (const t of targets) {
        patchFile(t.id, { status: "processing" });
        try {
          const logId = await logImport({
            filename: t.parsed!.filename,
            building: t.parsed!.building,
            status: "success",
            inserted: 0,
            skipped: 0,
            userId: opts.userId,
          });
          const res = await persistParsed(t.parsed!, undefined, logId, t.file);
          if (logId) {
            await (supabase as any).from("mdr_import_logs")
              .update({ rows_inserted: res.inserted, rows_skipped: res.skipped })
              .eq("id", logId);
          }
          patchFile(t.id, { status: "done", result: res });
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          await logImport({
            filename: t.parsed!.filename,
            building: t.parsed!.building ?? null,
            status: "failed",
            inserted: 0,
            skipped: 0,
            userId: opts.userId,
            errorSummary: msg,
          });
          patchFile(t.id, { status: "failed", error: msg });
        }
      }
      opts.onImported?.();
      if (targets.length > 0) {
        (async () => {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const m = await computeMatrix(today);
            await saveSnapshot(m);
            toast.success("설계진도율 스냅샷 갱신 완료");
          } catch (e: any) {
            toast.error(`설계진도율 스냅샷 갱신 실패: ${e?.message ?? e}`);
          }
        })();
      }
    } finally {
      setState({ isRunning: false });
    }
  },
};
