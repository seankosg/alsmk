import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import { multiSelectFilterFn, textFilterFn, dateRangeFilterFn, progressFilterFn, formatPct } from "./filterFns";

export interface MdrDrawingRow {
  id: string;
  source_no: string | null;
  building_code: string | null;
  item_no: string | null;
  discipline: string | null;
  drawing_title: string | null;
  plan_finish: string | null;
  updated_at: string | null;
  sd_mark: string;
  dd_mark: string;
  cd_mark: string;
  dd_pct: number;
  cd_pct: number;
  overall_pct: number;
  sdCells: Record<number, { p: number; a: number; delta: number } | null>;
  ddCells: Record<number, { p: number; a: number; delta: number } | null>;
  cdCells: Record<number, { p: number; a: number; delta: number } | null>;
  _raw: any;
}

export const SD_PCTS = [50, 100];
export const DD_PCTS = [30, 60, 90, 100];
export const CD_PCTS = [30, 60, 100];

const DISCIPLINE_OPTIONS = ["A", "S", "M", "E", "P", "C", "I"].map((v) => ({ value: v, label: v }));
const MARK_OPTIONS = [{ value: "O", label: "O" }, { value: "-", label: "-" }];

const naturalSort = (rowA: any, rowB: any, columnId: string) => {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
};

type Stage = "sd" | "dd" | "cd";

function buildMilestoneCols(
  stage: Stage,
  pcts: number[],
  cellsKey: "sdCells" | "ddCells" | "cdCells",
  deltaCls: (delta: number) => string,
): ColumnDef<MdrDrawingRow>[] {
  const cols: ColumnDef<MdrDrawingRow>[] = [];
  const upper = stage.toUpperCase();
  const numericSort = (a: any, b: any, id: string) => {
    const va = a.getValue(id);
    const vb = b.getValue(id);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return Number(va) - Number(vb);
  };
  for (const p of pcts) {
    const base = `${stage}_${p}`;
    // Plan
    cols.push({
      id: `${base}_p`,
      accessorFn: (r) => r[cellsKey][p]?.p ?? null,
      header: `${upper}${p} P`,
      size: 64,
      enableSorting: true,
      enableColumnFilter: true,
      sortingFn: numericSort,
      sortUndefined: "last",
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        if (v == null) return <span className="text-muted-foreground text-center block">-</span>;
        return <span className="text-right block tabular-nums text-muted-foreground">{Math.round(v)}</span>;
      },
    });
    // Actual
    cols.push({
      id: `${base}_a`,
      accessorFn: (r) => r[cellsKey][p]?.a ?? null,
      header: `${upper}${p} A`,
      size: 64,
      enableSorting: true,
      enableColumnFilter: true,
      sortingFn: numericSort,
      sortUndefined: "last",
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        if (v == null) return <span className="text-muted-foreground text-center block">-</span>;
        return <span className="text-right block tabular-nums">{Math.round(v)}</span>;
      },
    });
    // Delta
    cols.push({
      id: `${base}_d`,
      accessorFn: (r) => r[cellsKey][p]?.delta ?? null,
      header: `${upper}${p} Δ`,
      size: 64,
      enableSorting: true,
      enableColumnFilter: true,
      sortingFn: numericSort,
      sortUndefined: "last",
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        if (v == null) return <span className="text-muted-foreground text-center block">-</span>;
        return <span className={`text-right block tabular-nums ${deltaCls(v)}`}>{Math.round(v)}</span>;
      },
    });
  }
  return cols;
}

export function buildMdrColumns(deltaCls: (delta: number) => string): ColumnDef<MdrDrawingRow>[] {
  const sdCols = buildMilestoneCols("sd", SD_PCTS, "sdCells", deltaCls);
  const ddCols = buildMilestoneCols("dd", DD_PCTS, "ddCells", deltaCls);
  const cdCols = buildMilestoneCols("cd", CD_PCTS, "cdCells", deltaCls);

  return [
    {
      id: "__select__",
      size: 36,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          aria-label="Select all"
          className="h-3.5 w-3.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          className="h-3.5 w-3.5"
        />
      ),
    },
    {
      accessorKey: "source_no", header: "No.", size: 80,
      sortingFn: naturalSort,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: [] as { value: string; label: string }[] },
    },
    {
      accessorKey: "building_code", header: "Building", size: 90,
      sortingFn: naturalSort,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: [] },
    },
    {
      accessorKey: "item_no", header: "Item No.", size: 130,
      sortingFn: naturalSort,
      cell: ({ getValue }) => <span className="font-mono">{(getValue() as string) ?? ""}</span>,
      filterFn: textFilterFn,
      meta: { filterType: "text" },
    },
    {
      accessorKey: "discipline", header: "Disc.", size: 70,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: DISCIPLINE_OPTIONS },
    },
    {
      accessorKey: "drawing_title", header: "Title", size: 280,
      cell: ({ getValue }) => (
        <span className="block truncate" title={(getValue() as string) ?? ""}>
          {(getValue() as string) ?? ""}
        </span>
      ),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
    },
    {
      accessorKey: "sd_mark", header: "SD", size: 50,
      cell: ({ getValue }) => <span className="text-center block">{(getValue() as string) || "-"}</span>,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: MARK_OPTIONS },
    },
    {
      accessorKey: "dd_mark", header: "DD", size: 50,
      cell: ({ getValue }) => <span className="text-center block">{(getValue() as string) || "-"}</span>,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: MARK_OPTIONS },
    },
    {
      accessorKey: "cd_mark", header: "CD", size: 50,
      cell: ({ getValue }) => <span className="text-center block">{(getValue() as string) || "-"}</span>,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: MARK_OPTIONS },
    },
    ...sdCols,
    ...ddCols,
    ...cdCols,
    {
      accessorKey: "dd_pct", header: "DD%", size: 80,
      cell: ({ getValue }) => <span className="text-right block tabular-nums">{formatPct(getValue())}</span>,
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
    },
    {
      accessorKey: "cd_pct", header: "CD%", size: 80,
      cell: ({ getValue }) => <span className="text-right block tabular-nums">{formatPct(getValue())}</span>,
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
    },
    {
      accessorKey: "overall_pct", header: "Overall%", size: 90,
      cell: ({ getValue }) => <span className="text-right block tabular-nums font-semibold">{formatPct(getValue())}</span>,
      filterFn: progressFilterFn,
      meta: { filterType: "text" },
    },
    {
      accessorKey: "plan_finish", header: "Plan Finish", size: 120,
      cell: ({ getValue }) => <span>{(getValue() as string) ?? "-"}</span>,
      filterFn: dateRangeFilterFn,
      meta: { filterType: "date-range" },
    },
    {
      accessorKey: "updated_at", header: "Updated", size: 140,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="text-muted-foreground">{v ? v.slice(0, 16).replace("T", " ") : "-"}</span>;
      },
      filterFn: dateRangeFilterFn,
      meta: { filterType: "date-range" },
    },
  ];
}

export { ColumnFilterDropdown };
