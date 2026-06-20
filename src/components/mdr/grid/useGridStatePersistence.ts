import { useEffect, useState } from "react";
import type { ColumnFiltersState, ColumnSizingState, SortingState, VisibilityState } from "@tanstack/react-table";

export interface PersistedGridState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnSizing: ColumnSizingState;
  columnVisibility: VisibilityState;
  groupCollapsed?: { dd: boolean; cd: boolean };
}

const DEFAULT_STATE: PersistedGridState = {
  sorting: [],
  columnFilters: [],
  columnSizing: {},
  columnVisibility: {},
  groupCollapsed: { dd: false, cd: false },
};

export function useGridStatePersistence(key: string | null) {
  const [state, setState] = useState<PersistedGridState>(() => {
    if (!key || typeof window === "undefined") return DEFAULT_STATE;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [key, state]);

  return [state, setState] as const;
}
