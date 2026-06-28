import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { importerStore, type ImportFile, type ImportFileStatus } from "@/lib/mdr/import/importerStore";

export type { ImportFile, ImportFileStatus };

export function useMdrImporter(onImported?: () => void) {
  const { user } = useAuth();
  const state = useSyncExternalStore(
    importerStore.subscribe,
    importerStore.getState,
    importerStore.getState,
  );

  const addFiles = useCallback((files: File[]) => importerStore.addFiles(files), []);
  const removeFile = useCallback((id: string) => importerStore.removeFile(id), []);
  const clearAll = useCallback(() => importerStore.clearAll(), []);
  const startImport = useCallback(
    () => importerStore.startImport({ userId: user?.id ?? null, onImported }),
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
