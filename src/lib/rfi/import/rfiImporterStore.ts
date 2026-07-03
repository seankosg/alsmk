/**
 * RFI Import 상태 싱글톤 store.
 * MDR importerStore와 동일한 구조로, 라우트 이동 후 재방문해도
 * 진행/완료 카드가 유지되도록 모듈 레벨에 상태를 보관한다.
 */
import { parseRfiFile, type RfiParseResult } from "@/lib/rfi/parser";
import { importRfiFile, type RfiImportResult } from "@/lib/rfi/importRunner";
import { toast } from "sonner";

export type RfiImportFileStatus =
  | "pending"
  | "parsing"
  | "ready"
  | "processing"
  | "done"
  | "failed";

export interface RfiImportFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: RfiImportFileStatus;
  parsed?: RfiParseResult;
  parsedCount?: number;
  error?: string;
  result?: RfiImportResult;
}

export interface RfiImporterState {
  files: RfiImportFile[];
  isRunning: boolean;
}

type Listener = () => void;

let state: RfiImporterState = { files: [], isRunning: false };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<RfiImporterState>) {
  state = { ...state, ...patch };
  emit();
}

function patchFile(id: string, patch: Partial<RfiImportFile>) {
  state = {
    ...state,
    files: state.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  };
  emit();
}

let _uid = 0;
const uid = () => `rfi${Date.now()}-${++_uid}`;

export const rfiImporterStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState(): RfiImporterState {
    return state;
  },

  async addFiles(incoming: File[]) {
    if (!incoming.length) return;
    const newOnes: RfiImportFile[] = incoming
      .filter((f) => /\.xlsx?$/i.test(f.name))
      .map((file) => ({
        id: uid(),
        file,
        name: file.name,
        size: file.size,
        status: "parsing" as RfiImportFileStatus,
      }));
    if (!newOnes.length) return;
    setState({ files: [...state.files, ...newOnes] });

    for (const item of newOnes) {
      try {
        const parsed = await parseRfiFile(item.file);
        patchFile(item.id, {
          status: "ready",
          parsed,
          parsedCount: parsed.rows.length,
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
      const targets = state.files.filter((f) => f.status === "ready");
      let anyDone = false;
      for (const t of targets) {
        patchFile(t.id, { status: "processing" });
        try {
          const res = await importRfiFile(t.file, opts.userId);
          patchFile(t.id, { status: "done", result: res });
          anyDone = true;
        } catch (e: any) {
          patchFile(t.id, { status: "failed", error: e?.message ?? String(e) });
        }
      }
      opts.onImported?.();
      if (anyDone) toast.success("RFI 임포트 완료");
    } finally {
      setState({ isRunning: false });
    }
  },
};
