import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, FileSpreadsheet } from "lucide-react";
import { multiSelectFilterFn, textFilterFn, dateRangeFilterFn } from "@/components/mdr/grid/filterFns";
import { STATUS_META, type RfiStatus } from "@/lib/rfi/statusEngine";

export interface RfiMasterRow {
  id: string;
  rfi_no: string;
  direction: string | null;
  discipline: string | null;
  originator: string | null;
  title_clean: string | null;
  latest_from: string | null;
  latest_to: string | null;
  issue_date: string | null;
  due_date: string | null;
  response_date: string | null;
  closed_date: string | null;
  days_open: number | null;
  status: RfiStatus;
  event_count: number;
  latest_filename: string | null;
}

const naturalSort = (a: any, b: any, id: string) =>
  String(a.getValue(id) ?? "").localeCompare(String(b.getValue(id) ?? ""), undefined, { numeric: true, sensitivity: "base" });

const numericSort = (a: any, b: any, id: string) => {
  const va = a.getValue(id), vb = b.getValue(id);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return Number(va) - Number(vb);
};

const DIR_OPTIONS = [
  { value: "Outgoing", label: "Outgoing" },
  { value: "Incoming", label: "Incoming" },
  { value: "Unknown", label: "Unknown" },
];

const STATUS_OPTIONS = (Object.keys(STATUS_META) as RfiStatus[]).map((k) => ({
  value: k, label: STATUS_META[k].label,
}));

export interface BuildRfiColumnsOptions {
  onRemind: (row: RfiMasterRow) => void;
  disciplineOptions: { value: string; label: string }[];
}

export function buildRfiColumns(opts: BuildRfiColumnsOptions): ColumnDef<RfiMasterRow>[] {
  const { onRemind, disciplineOptions } = opts;
  return [
    {
      accessorKey: "rfi_no", header: "RFI No", size: 140,
      sortingFn: naturalSort,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) ?? "-"}</span>,
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      accessorKey: "direction", header: "Dir", size: 90,
      cell: ({ getValue }) => {
        const v = (getValue() as string) ?? "-";
        return <Badge variant="outline" className="text-[10px]">{v}</Badge>;
      },
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: DIR_OPTIONS },
    },
    {
      accessorKey: "discipline", header: "Disp", size: 90,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) ?? "-"}</span>,
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: disciplineOptions },
    },
    {
      accessorKey: "originator", header: "Originator", size: 130,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) ?? "-"}</span>,
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      accessorKey: "title_clean", header: "Title", size: 340,
      cell: ({ getValue }) => (
        <span className="block truncate" title={(getValue() as string) ?? ""}>
          {(getValue() as string) ?? "-"}
        </span>
      ),
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      accessorKey: "latest_from", header: "From", size: 130,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) ?? "-"}</span>,
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      accessorKey: "latest_to", header: "To", size: 130,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) ?? "-"}</span>,
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      accessorKey: "issue_date", header: "Issue", size: 110,
      sortingFn: naturalSort, sortUndefined: "last",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="tabular-nums text-xs">{v ? v.slice(0, 10) : "-"}</span>;
      },
      filterFn: dateRangeFilterFn, meta: { filterType: "date-range" },
    },
    {
      accessorKey: "due_date", header: "Due", size: 110,
      sortingFn: naturalSort, sortUndefined: "last",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="tabular-nums text-xs">{v ? v.slice(0, 10) : "-"}</span>;
      },
      filterFn: dateRangeFilterFn, meta: { filterType: "date-range" },
    },
    {
      accessorKey: "response_date", header: "Response", size: 110,
      sortingFn: naturalSort, sortUndefined: "last",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="tabular-nums text-xs">{v ? v.slice(0, 10) : "-"}</span>;
      },
      filterFn: dateRangeFilterFn, meta: { filterType: "date-range" },
    },
    {
      accessorKey: "closed_date", header: "Closed", size: 110,
      sortingFn: naturalSort, sortUndefined: "last",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="tabular-nums text-xs">{v ? v.slice(0, 10) : "-"}</span>;
      },
      filterFn: dateRangeFilterFn, meta: { filterType: "date-range" },
    },
    {
      accessorKey: "days_open", header: "Days", size: 70,
      sortingFn: numericSort, sortUndefined: "last",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="tabular-nums text-right block text-xs">{v ?? "-"}</span>;
      },
    },
    {
      accessorKey: "status", header: "Status", size: 120,
      cell: ({ getValue }) => {
        const s = getValue() as RfiStatus;
        const m = STATUS_META[s] ?? STATUS_META.Info;
        return <Badge className={m.cls}>{m.label}</Badge>;
      },
      filterFn: multiSelectFilterFn,
      meta: { filterType: "multi-select", filterOptions: STATUS_OPTIONS },
    },
    {
      accessorKey: "event_count", header: "Ev", size: 60,
      sortingFn: numericSort,
      cell: ({ getValue }) => (
        <span className="tabular-nums text-xs text-muted-foreground">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "latest_filename", header: "Source", size: 240,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate" title={v}>
            <FileSpreadsheet className="h-3 w-3 shrink-0" />
            <span className="truncate">{v}</span>
          </span>
        );
      },
      filterFn: textFilterFn, meta: { filterType: "text" },
    },
    {
      id: "__action__",
      header: "Action",
      size: 110,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status !== "Overdue" && r.status !== "DueSoon") return null;
        return (
          <Button
            size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={(e) => { e.stopPropagation(); onRemind(r); }}
          >
            <BellRing className="h-3 w-3 mr-1" /> Remind
          </Button>
        );
      },
    },
  ];
}
