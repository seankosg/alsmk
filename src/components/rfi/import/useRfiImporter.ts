import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  rfiImporterStore,
  type RfiImportFile,
  type RfiImportFileStatus,
} from "@/lib/rfi/import/rfiImporterStore";

export type { RfiImportFile, RfiImportFileStatus };

export function useRfiImporter(onImported?: () => void) {
  const { user } = useAuth();
  const state = useSyncExternalStore(
    rfiImporterStore.subscribe,
    rfiImporterStore.getState,
    rfiImporterStore.getState,
  );

  const addFiles = useCallback((files: File[]) => rfiImporterStore.addFiles(files), []);
  const removeFile = useCallback((id: string) => rfiImporterStore.removeFile(id), []);
  const clearAll = useCallback(() => rfiImporterStore.clearAll(), []);
  const startImport = useCallback(
    () => rfiImporterStore.startImport({ userId: user?.id ?? null, onImported }),
    [user?.id, onImported],
  );

  const readyCount = state.files.filter((f) => f.status === "ready").length;

  return {
    files: state.files,
    isRunning: state.isRunning,
    addFiles,
    removeFile,
    clearAll,
    startImport,
    readyCount,
  };
}
