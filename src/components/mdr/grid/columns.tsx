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
  ddCells: Record<number, { p: number; a: number; delta: number } | null>;
  cdCells: Record<number, { p: number; a: number; delta: number } | null>;
  _raw: any;
}

export const DD_PCTS = [30, 60, 90, 100];
export const CD_PCTS = [30, 60, 100];

const DISCIPLINE_OPTIONS = ["A", "S", "M", "E", "P", "C", "I"].map((v) => ({ value: v, label: v }));
const MARK_OPTIONS = [{ value: "O", label: "O" }, { value: "-", label: "-" }];

export function buildMdrColumns(deltaCls: (delta: number) => string): ColumnDef<MdrDrawingRow>[] {
  const stageCellRender = (cell: { p: number; a: number; delta: number } | null | undefined) => {
    if (!cell) return <span className="text-muted-foreground">-</span>;
    return (
      <span className="tabular-nums">
        <span className="text-muted-foreground">{cell.p.toFixed(0)}</span>
        /<span>{cell.a.toFixed(0)}</span>
        /<span className={deltaCls(cell.delta)}>{cell.delta.toFixed(0)}</span>
      </span>
    );
  };

  const ddStageCols: ColumnDef<MdrDrawingRow>[] = DD_PCTS.map((p) => ({
    id: `dd_${p}`,
    accessorFn: (r) => r.ddCells[p]?.delta ?? null,
    header: `DD${p} P/A/Δ`,
    size: 110,
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) => stageCellRender(row.original.ddCells[p]),
  }));

  const cdStageCols: ColumnDef<MdrDrawingRow>[] = CD_PCTS.map((p) => ({
    id: `cd_${p}`,
    accessorFn: (r) => r.cdCells[p]?.delta ?? null,
    header: `CD${p} P/A/Δ`,
    size: 110,
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) => stageCellRender(row.original.cdCells[p]),
  }));

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
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: [] as { value: string; label: string }[] },
    },
    {
      accessorKey: "building_code", header: "Building", size: 90,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: [] },
    },
    {
      accessorKey: "item_no", header: "Item No.", size: 130,
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
    ...ddStageCols,
    ...cdStageCols,
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
