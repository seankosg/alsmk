import { useMemo, useRef, useState, useEffect, type CSSProperties } from "react";
import {
  flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues,
  getFilteredRowModel, getSortedRowModel, useReactTable,
  type ColumnFiltersState, type ColumnSizingState, type SortingState,
  type VisibilityState, type Header,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Settings2, Search, X, Download,
  GripVertical, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { ColumnFilterDropdown } from "@/components/mdr/grid/ColumnFilterDropdown";
import { TopHorizontalScrollbar } from "@/components/mdr/grid/TopHorizontalScrollbar";
import { useGridStatePersistence } from "@/components/mdr/grid/useGridStatePersistence";
import { buildRfiColumns, type RfiMasterRow } from "./rfiColumns";

interface Props {
  rows: RfiMasterRow[];
  isLoading?: boolean;
  persistKey?: string | null;
  onRowClick?: (row: RfiMasterRow) => void;
  onRemind: (row: RfiMasterRow) => void;
}

function SortableHeaderCell({
  header,
}: { header: Header<RfiMasterRow, unknown> }) {
  const draggable = header.column.id !== "__action__";
  const sortable = useSortable({ id: header.column.id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  const canFilter = header.column.getCanFilter() && (header.column.columnDef.meta as any)?.filterType;
  const w = header.getSize();
  const style: CSSProperties = {
    width: w, minWidth: w, maxWidth: w,
    position: "sticky", top: 0,
    zIndex: isDragging ? 4 : 2,
    background: "hsl(var(--muted))",
    transform: draggable ? CSS.Translate.toString(transform) : undefined,
    transition: draggable ? transition : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <th
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className="border-r border-b-2 border-border px-2 py-1.5 text-left font-medium text-foreground relative"
    >
      <div className="flex items-center gap-1">
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label="컬럼 위치 이동"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span
          className={cn("flex-1 truncate", canSort && "cursor-pointer select-none")}
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        >
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
}

function sanitizeOrder(prev: string[], def: string[]): string[] {
  const valid = new Set(def);
  const seen = new Set<string>();
  let order = prev.filter((id) => valid.has(id) && !seen.has(id) && seen.add(id) !== undefined);
  const has = new Set(order);
  for (let i = 0; i < def.length; i++) {
    if (has.has(def[i])) continue;
    let insertAt = order.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = order.indexOf(def[j]);
      if (idx >= 0) { insertAt = idx + 1; break; }
    }
    order.splice(insertAt, 0, def[i]);
  }
  return order;
}

export function RfiAdvancedGrid({ rows, isLoading, persistKey, onRowClick, onRemind }: Props) {
  const { toast } = useToast();

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.discipline) set.add(r.discipline);
    return [...set].sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const columns = useMemo(
    () => buildRfiColumns({ onRemind, disciplineOptions }),
    [onRemind, disciplineOptions],
  );

  const defaultOrder = useMemo(
    () => columns.map((c: any) => c.id ?? c.accessorKey).filter(Boolean) as string[],
    [columns],
  );

  const validIds = useMemo(() => new Set(defaultOrder), [defaultOrder]);
  const [persisted, setPersisted] = useGridStatePersistence(persistKey ?? null);

  const pruneById = <T extends { id: string }>(arr: T[]) => arr.filter((x) => validIds.has(x.id));
  const pruneRec = <T,>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([k]) => validIds.has(k))) as Record<string, T>;

  const [sorting, setSorting] = useState<SortingState>(() => pruneById(persisted.sorting));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => pruneById(persisted.columnFilters));
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => pruneRec(persisted.columnSizing));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => pruneRec(persisted.columnVisibility));
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    sanitizeOrder(persisted.columnOrder ?? [], defaultOrder),
  );
  useEffect(() => {
    setColumnOrder((prev) => sanitizeOrder(prev, defaultOrder));
  }, [defaultOrder]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobal, setDebouncedGlobal] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobal(globalFilter), 200);
    return () => clearTimeout(t);
  }, [globalFilter]);

  useEffect(() => {
    setPersisted({ sorting, columnFilters, columnSizing, columnVisibility, columnOrder });
  }, [sorting, columnFilters, columnSizing, columnVisibility, columnOrder, setPersisted]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, columnSizing, columnVisibility, columnOrder, globalFilter: debouncedGlobal },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder as any,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (r) => r.id,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    globalFilterFn: (row, _id, value) => {
      if (!value) return true;
      const v = String(value).toLowerCase();
      const r = row.original;
      return [r.rfi_no, r.title_clean, r.discipline, r.originator, r.latest_from, r.latest_to]
        .some((f) => String(f ?? "").toLowerCase().includes(v));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const visibleLeaf = table.getVisibleLeafColumns();
  const totalWidth = visibleLeaf.reduce((s, c) => s + c.getSize(), 0);
  const { rows: tableRows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const activeFilters = columnFilters;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const a = String(e.active?.id ?? "");
    const o = String(e.over?.id ?? "");
    if (!a || !o || a === o) return;
    if (a === "__action__" || o === "__action__") return;
    setColumnOrder((prev) => {
      const base = prev.length ? prev : defaultOrder;
      const next = [...base];
      const from = next.indexOf(a), to = next.indexOf(o);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, a);
      return sanitizeOrder(next, defaultOrder);
    });
  };

  const exportXlsx = async () => {
    try {
      const XLSX: any = await import(/* @vite-ignore */ "xlsx").catch(() => null);
      if (!XLSX) {
        toast({ title: "xlsx 라이브러리 누락", variant: "destructive" });
        return;
      }
      const cols = visibleLeaf.filter((c) => c.id !== "__action__");
      const header = cols.map((c) => (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id));
      const aoa: any[][] = [header];
      for (const r of tableRows) {
        aoa.push(cols.map((c) => {
          const v = r.getValue(c.id);
          if (v == null) return "";
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
          return v;
        }));
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = cols.map((c) => ({ wch: Math.max(8, Math.round(c.getSize() / 7)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RFI");
      XLSX.writeFile(wb, `rfi_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: "Export 완료", description: `${tableRows.length}행 / ${cols.length}열` });
    } catch (e: any) {
      toast({ title: "Export 실패", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const leafIds = visibleLeaf.map((c) => c.id);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="전체 검색..."
            className="h-8 w-[240px] pl-7 text-xs"
          />
        </div>
        <Badge variant="outline" className="text-[10px]">{tableRows.length} / {rows.length}행</Badge>

        {activeFilters.length > 0 && (
          <>
            {activeFilters.map((f) => (
              <Badge key={f.id} variant="secondary" className="cursor-pointer text-[10px]"
                onClick={() => table.getColumn(f.id)?.setFilterValue(undefined)}>
                {f.id} <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setColumnFilters([])}>
              모두 해제
            </Button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportXlsx}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Settings2 className="mr-1 h-3.5 w-3.5" />Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2 max-h-96 overflow-auto">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-medium text-muted-foreground">컬럼 표시</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="text-[11px] text-muted-foreground hover:underline"
                    onClick={() => table.getAllLeafColumns().forEach((c) => c.toggleVisibility(true))}>전체</button>
                  <button type="button" className="text-[11px] text-muted-foreground hover:underline"
                    onClick={() => table.getAllLeafColumns().forEach((c) => c.toggleVisibility(false))}>해제</button>
                </div>
              </div>
              <button type="button"
                className="flex w-full items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                onClick={() => setColumnOrder(defaultOrder)}>
                <RotateCcw className="h-3 w-3" /> 컬럼 순서 초기화
              </button>
              <div className="my-1 h-px bg-border" />
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50">
                  <Checkbox checked={col.getIsVisible()} onCheckedChange={(v) => col.toggleVisibility(!!v)} className="h-3.5 w-3.5" />
                  <span className="flex-1 truncate">
                    {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                  </span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <TopHorizontalScrollbar targetRef={tableRef} width={totalWidth} />

      <div ref={tableRef} className="relative max-h-[70vh] overflow-auto">
        {isLoading && (
          <div className="p-6 text-center text-muted-foreground text-sm">로딩 중...</div>
        )}
        {!isLoading && !rows.length && (
          <div className="p-6 text-center text-muted-foreground text-sm">데이터가 없습니다.</div>
        )}
        {!isLoading && rows.length > 0 && (() => {
          const items = rowVirtualizer.getVirtualItems();
          const totalSize = rowVirtualizer.getTotalSize();
          const padTop = items.length ? items[0].start : 0;
          const padBot = items.length ? totalSize - items[items.length - 1].end : 0;
          const leafCount = visibleLeaf.length;
          return (
            <table className="text-xs" style={{ width: totalWidth, tableLayout: "fixed" }}>
              <colgroup>
                {visibleLeaf.map((col) => <col key={col.id} style={{ width: col.getSize() }} />)}
              </colgroup>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={leafIds} strategy={horizontalListSortingStrategy}>
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((header) => (
                          <SortableHeaderCell key={header.id} header={header} />
                        ))}
                      </tr>
                    ))}
                  </thead>
                </SortableContext>
              </DndContext>
              <tbody>
                {padTop > 0 && (
                  <tr aria-hidden style={{ height: padTop }}>
                    <td colSpan={leafCount} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
                {items.map((vrow) => {
                  const row = tableRows[vrow.index];
                  return (
                    <tr key={row.id} data-index={vrow.index}
                      onClick={() => onRowClick?.(row.original)}
                      className={cn("border-t hover:bg-muted/30", onRowClick && "cursor-pointer")}
                      style={{ height: vrow.size }}>
                      {row.getVisibleCells().map((cell) => {
                        const w = cell.column.getSize();
                        return (
                          <td key={cell.id}
                            style={{ width: w, minWidth: w, maxWidth: w, overflow: "hidden" }}
                            className="border-r px-2 py-1 truncate whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {padBot > 0 && (
                  <tr aria-hidden style={{ height: padBot }}>
                    <td colSpan={leafCount} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
              </tbody>
            </table>
          );
        })()}
      </div>
    </Card>
  );
}
