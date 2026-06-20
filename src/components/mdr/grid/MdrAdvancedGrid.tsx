import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { drawingStagePct } from "@/lib/mdr/progressEngine";
import type { MdrStage } from "@/lib/mdr/parser";
import { useAuthContext } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { buildMdrColumns, ColumnFilterDropdown, DD_PCTS, CD_PCTS, type MdrDrawingRow } from "./columns";
import { TopHorizontalScrollbar } from "./TopHorizontalScrollbar";
import { useGridStatePersistence } from "./useGridStatePersistence";
import { MdrBulkActionBar } from "./MdrBulkActionBar";

interface Props {
  buildingCode: string;
  asOf: string;
  threshold: number;
  sheetName?: string;
}

export function MdrAdvancedGrid({ buildingCode, asOf, threshold, sheetName }: Props) {
  const { user, isAdminOrPm, memberName } = useAuthContext();

  const { data, isLoading } = useQuery({
    queryKey: ["mdr_drawings", buildingCode, sheetName ?? null],
    queryFn: async () => {
      let q = supabase
        .from("mdr_drawings" as never)
        .select("*, mdr_milestones(*), mdr_progress(*)")
        .eq("building_code", buildingCode)
        .order("discipline")
        .order("source_no");
      if (sheetName) q = q.eq("source_sheet", sheetName);
      const { data: drawings, error } = await q;
      if (error) throw error;
      return (drawings as any[]) ?? [];
    },
  });

  const rows: MdrDrawingRow[] = useMemo(() => {
    return (data ?? []).map((d: any): MdrDrawingRow => {
      const ms = d.mdr_milestones ?? [];
      const pg = d.mdr_progress ?? [];
      const sd = drawingStagePct(ms, pg, "SD", asOf);
      const dd = drawingStagePct(ms, pg, "DD", asOf);
      const cd = drawingStagePct(ms, pg, "CD", asOf);
      const overall = (sd.actual + dd.actual + cd.actual) / 3;

      const buildCell = (stage: MdrStage, pct: number) => {
        const m = ms.find((x: any) => x.stage === stage && x.pct === pct);
        const p = pg.find((x: any) => x.stage === stage && x.pct === pct);
        if (!m) return null;
        const aShow = p?.is_done ? Number(m.increment_pct) : 0;
        const pShow = Number(m.increment_pct);
        return { p: pShow, a: aShow, delta: pShow - aShow };
      };

      const ddCells: MdrDrawingRow["ddCells"] = {};
      DD_PCTS.forEach((p) => { ddCells[p] = buildCell("DD", p); });
      const cdCells: MdrDrawingRow["cdCells"] = {};
      CD_PCTS.forEach((p) => { cdCells[p] = buildCell("CD", p); });

      return {
        id: d.id,
        source_no: d.source_no,
        building_code: d.building_code,
        item_no: d.item_no,
        discipline: d.discipline,
        drawing_title: d.drawing_title,
        plan_finish: d.plan_finish,
        updated_at: d.updated_at,
        sd_mark: "O",
        dd_mark: dd.planned + dd.actual > 0 ? "O" : "-",
        cd_mark: cd.planned + cd.actual > 0 ? "O" : "-",
        dd_pct: dd.actual,
        cd_pct: cd.actual,
        overall_pct: overall,
        ddCells,
        cdCells,
        _raw: d,
      };
    });
  }, [data, asOf]);

  const deltaCls = (delta: number) => {
    if (delta <= 0) return "text-green-600";
    if (delta < threshold) return "text-yellow-500";
    return "text-destructive font-semibold";
  };

  const columns = useMemo(() => buildMdrColumns(deltaCls), [threshold]);

  // 영속화 (rowSelection 제외)
  const persistKey = user ? `mdr-raw-grid-state:${user.id}:${buildingCode}:${sheetName ?? "all"}` : null;
  const [persisted, setPersisted] = useGridStatePersistence(persistKey);
  const [sorting, setSorting] = useState<SortingState>(persisted.sorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(persisted.columnFilters);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(persisted.columnSizing);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(persisted.columnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobal, setDebouncedGlobal] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobal(globalFilter), 200);
    return () => clearTimeout(t);
  }, [globalFilter]);

  useEffect(() => {
    setPersisted({ sorting, columnFilters, columnSizing, columnVisibility });
  }, [sorting, columnFilters, columnSizing, columnVisibility, setPersisted]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, columnSizing, columnVisibility, rowSelection, globalFilter: debouncedGlobal },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (r) => r.id,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    globalFilterFn: (row, _id, value) => {
      if (!value) return true;
      const v = String(value).toLowerCase();
      const r = row.original;
      return [r.source_no, r.item_no, r.drawing_title, r.discipline, r.building_code]
        .some((f) => String(f ?? "").toLowerCase().includes(v));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = visibleLeafColumns.reduce((sum, c) => sum + c.getSize(), 0);

  const { rows: tableRows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const activeFilters = columnFilters;

  if (isLoading) return <Card className="p-6 text-muted-foreground">로딩 중...</Card>;
  if (!rows.length) return <Card className="p-6 text-muted-foreground">데이터 없음</Card>;

  const visibleIds = visibleLeafColumns.map((c) => c.id);

  return (
    <Card className="flex flex-col overflow-hidden">
      <MdrBulkActionBar
        selectedRows={selectedRows}
        onClearSelection={() => setRowSelection({})}
        visibleColumnIds={visibleIds}
        userName={memberName ?? user?.email ?? null}
        canEdit={isAdminOrPm}
      />

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="전체 검색..."
            className="h-8 w-[220px] pl-7 text-xs"
          />
        </div>
        <Badge variant="outline" className="text-[10px]">{tableRows.length} / {rows.length}행</Badge>

        {activeFilters.length > 0 && (
          <>
            {activeFilters.map((f) => (
              <Badge key={f.id} variant="secondary" className="cursor-pointer text-[10px]" onClick={() => table.getColumn(f.id)?.setFilterValue(undefined)}>
                {f.id} <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setColumnFilters([])}>모두 해제</Button>
          </>
        )}

        <div className="ml-auto" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs"><Settings2 className="mr-1 h-3.5 w-3.5" />Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
            <DropdownMenuLabel className="text-xs">컬럼 표시</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().filter((c) => c.id !== "__select__").map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(v) => col.toggleVisibility(!!v)}
                className="text-xs"
              >
                {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TopHorizontalScrollbar targetRef={tableRef} width={totalWidth} />

      {/* 본문 */}
      <div ref={tableRef} className="relative max-h-[70vh] overflow-auto">
        <table className="text-xs" style={{ width: totalWidth, minWidth: "100%" }}>
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const canFilter = header.column.getCanFilter() && (header.column.columnDef.meta as any)?.filterType;
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: "relative" }}
                      className="border-r px-2 py-1.5 text-left font-medium"
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn("flex-1 truncate", canSort && "cursor-pointer select-none")} onClick={canSort ? header.column.getToggleSortingHandler() : undefined}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" />
                            : sorted === "desc" ? <ArrowDown className="ml-1 inline h-3 w-3" />
                            : <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
                          )}
                        </span>
                        {canFilter && <ColumnFilterDropdown column={header.column} />}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/30"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: rowVirtualizer.getTotalSize(), position: "relative", display: "block" }}>
            {rowVirtualizer.getVirtualItems().map((vrow) => {
              const row = tableRows[vrow.index];
              return (
                <tr
                  key={row.id}
                  data-index={vrow.index}
                  className={cn("absolute left-0 flex w-full border-t hover:bg-muted/30", row.getIsSelected() && "bg-primary/10")}
                  style={{ transform: `translateY(${vrow.start}px)`, height: vrow.size }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="border-r px-2 py-1"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
