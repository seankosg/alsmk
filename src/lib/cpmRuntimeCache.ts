/**
 * CPM Runtime Cache — shared client-side cache for live CPM activity data.
 * The iframe posts activities here; KUKU dashboard widgets consume from here first,
 * falling back to DB queries only when the cache is empty.
 */

export const CPM_RUNTIME_KEY = "cpm-runtime" as const;

export interface CpmRuntimeActivity {
  id: string;
  mppTaskId: string | null;
  mppUid: string | null;
  name: string;
  duration: number;
  progress: number;
  wbsFull: string;
  isCritical: boolean;
  isMilestone: boolean;
  startDate: string | null;
  finishDate: string | null;
  es: number; ef: number; ls: number; lf: number; tf: number;
  customFields: Record<string, string>;
  predLinks: string;
}

export interface CpmRuntimeData {
  activities: CpmRuntimeActivity[];
  lastSyncTime: number; // Date.now()
  source: "cpm-calculated" | "cpm-runtime-data" | "db-fallback";
}
