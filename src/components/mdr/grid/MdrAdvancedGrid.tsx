import { useMemo, useRef, useState, useEffect, type CSSProperties } from "react";
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
  type Header,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2, Search, X, Download, GripVertical, RotateCcw, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { drawingStagePct, drawingMilestonePlannedPct, drawingOverall } from "@/lib/mdr/progressEngine";
import type { MdrStage } from "@/lib/mdr/parser";
import { useAuthContext } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  buildMdrColumns,
  ColumnFilterDropdown,
  SD_PCTS, DD_PCTS, CD_PCTS,
  STAGE_GROUP_LEAVES,
  getColumnGroupOf,
  type MdrDrawingRow,
} from "./columns";
import { buildMdrProgressIconCells } from "@/lib/mdr/progressIcon";
import { MdrProgressIconLegend, type ProgressGroup } from "./MdrProgressIconCell";
import { TopHorizontalScrollbar } from "./TopHorizontalScrollbar";
import { useGridStatePersistence } from "./useGridStatePersistence";
import { MdrBulkActionBar } from "./MdrBulkActionBar";

/**
 * 영속된 컬럼 순서를 현재 컬럼 정의 기준으로 정규화한다.
 * - 더 이상 존재하지 않는 id 제거
 * - 신규 추가된 id 는 기본 순서상의 위치에 삽입
 * - 같은 단계 그룹(sd_group/dd_group/cd_group) leaf 는 연속(contiguous) 상태 유지
 *   (drag 결과로 split 된 경우, 그룹 첫 leaf 위치로 모음)
 * - __select__ 는 항상 맨 앞
 */
function sanitizeColumnOrder(prev: string[], defaultOrder: string[]): string[] {
  const validSet = new Set(defaultOrder);
  // 1) 유효한 id 만, 중복 제거
  const seen = new Set<string>();
  let order = prev.filter((id) => validSet.has(id) && !seen.has(id) && seen.add(id) !== undefined);
  // 2) 신규 id 는 defaultOrder 의 위치에 삽입
  const inPrev = new Set(order);
  for (let i = 0; i < defaultOrder.length; i++) {
    const id = defaultOrder[i];
    if (inPrev.has(id)) continue;
    // defaultOrder 에서의 직전 id 가 order 에 있으면 그 뒤에, 없으면 맨 뒤에
    let insertAt = order.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = order.indexOf(defaultOrder[j]);
      if (idx >= 0) { insertAt = idx + 1; break; }
    }
    order.splice(insertAt, 0, id);
  }
  // 3) 그룹 contiguous 보장
  for (const [, leaves] of Object.entries(STAGE_GROUP_LEAVES)) {
    const presentLeaves = leaves.filter((l) => order.includes(l));
    if (presentLeaves.length < 2) continue;
    // 그룹 첫 leaf 위치
    const firstIdx = Math.min(...presentLeaves.map((l) => order.indexOf(l)));
    // 그룹 leaves 제거
    order = order.filter((id) => !presentLeaves.includes(id));
    // 그룹 leaves 의 정해진 P→A→Δ 순서 유지하며 firstIdx 에 삽입
    const ordered = leaves.filter((l) => presentLeaves.includes(l));
    order.splice(firstIdx, 0, ...ordered);
  }
  // 4) __select__ 가 있으면 맨 앞으로
  const selIdx = order.indexOf("__select__");
  if (selIdx > 0) {
    order.splice(selIdx, 1);
    order.unshift("__select__");
  }
  return order;
}

interface Props {
  buildingCode: string;
  asOf: string;
  threshold: number;
  sheetName?: string;
}

// ============================================================================
// 컬럼 드래그 reorder — dnd-kit wrapper (메인 컴포넌트 위에 선언해 hoisting/HMR 이슈 회피)
// ============================================================================

function DndHeaderContext({
  leafIds,
  onReorder,
  children,
}: {
  leafIds: string[];
  onReorder: (activeId: string, overId: string) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const active = String(e.active?.id ?? "");
    const over = String(e.over?.id ?? "");
    if (!active || !over) return;
    onReorder(active, over);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={leafIds} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function SortableHeaderCell({
  header,
  isLeaf,
}: {
  header: Header<MdrDrawingRow, unknown>;
  isLeaf: boolean;
}) {
  const isGroup = header.subHeaders.length > 0;
  const draggable = isLeaf && header.column.id !== "__select__";
  const sortable = useSortable({ id: header.column.id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const canSort = !isGroup && header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  const canFilter = !isGroup && header.column.getCanFilter() && (header.column.columnDef.meta as any)?.filterType;
  const w = header.getSize();
  const style: CSSProperties = {
    width: w,
    minWidth: w,
    maxWidth: w,
    position: "sticky",
    top: 0,
    zIndex: isDragging ? 4 : isGroup ? 3 : 2,
    background: isGroup ? "hsl(var(--primary) / 0.12)" : "hsl(var(--muted))",
    transform: draggable ? CSS.Translate.toString(transform) : undefined,
    transition: draggable ? transition : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  const thCls = isGroup
    ? "border-r border-b border-primary/30 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-primary"
    : "border-r border-b-2 border-border px-2 py-1.5 text-left font-medium text-foreground";
  return (
    <th
      ref={draggable ? setNodeRef : undefined}
      colSpan={header.colSpan}
      style={style}
      className={thCls}
    >
      <div className={cn("flex items-center gap-1", isGroup && "justify-center")}>
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label="컬럼 위치 이동"
            title="드래그하여 컬럼 위치 변경"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span
          className={cn(
            isGroup ? "truncate" : "flex-1 truncate",
            canSort && "cursor-pointer select-none",
          )}
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
      {isLeaf && header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/30"
        />
      )}
    </th>
  );
}

export function MdrAdvancedGrid({ buildingCode, asOf, threshold, sheetName }: Props) {
  const { user, isAdminOrPm, memberName } = useAuthContext();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["mdr_drawings", buildingCode, sheetName ?? null],
    queryFn: async () => {
      let q = supabase
        .from("mdr_drawings" as never)
        .select("*, mdr_milestones(*), mdr_milestone_cells(*), mdr_progress(*)")
        .eq("building_code", buildingCode)
        .order("discipline");
      if (sheetName) q = q.eq("source_sheet", sheetName);
      const { data: drawings, error } = await q;
      if (error) throw error;
      return (drawings as any[]) ?? [];
    },
  });

  const rows: MdrDrawingRow[] = useMemo(() => {
    return (data ?? []).map((d: any): MdrDrawingRow => {
      const ms = d.mdr_milestones ?? [];
      const cells = d.mdr_milestone_cells ?? [];
      const pgRaw = d.mdr_progress ?? [];
      // in_scope_* 가 null 인 레거시 행은 마일스톤 존재 여부로 폴백 판정.
      const hasStage = (st: MdrStage) =>
        ms.some((x: any) => x.stage === st && (x.plan_date || (x.pct ?? 0) > 0));
      const explicit =
        d.in_scope_sd !== null || d.in_scope_dd !== null || d.in_scope_cd !== null;
      const scope = {
        sd: explicit ? !!d.in_scope_sd : hasStage("SD"),
        dd: explicit ? !!d.in_scope_dd : hasStage("DD"),
        cd: explicit ? !!d.in_scope_cd : hasStage("CD"),
      };

      // 엔진용 셀/진척 정규화
      const cellRows = cells.map((x: any) => ({
        stage: x.stage as MdrStage,
        pct: Number(x.pct),
        subIdx: Number(x.sub_idx ?? 0),
        incrementPct: Number(x.increment_pct),
        planDate: x.plan_date ?? null,
      }));
      const pgRows = pgRaw.map((x: any) => ({
        stage: x.stage as MdrStage,
        pct: Number(x.pct),
        subIdx: Number(x.sub_idx ?? 0),
        isDone: !!x.is_done,
        actualDate: x.actual_date ?? null,
      }));

      const msRows = ms.map((x: any) => ({
        stage: x.stage,
        pct: Number(x.pct),
        incrementPct: Number(x.increment_pct),
        planDate: x.plan_date ?? null,
      }));

      const sd = drawingStagePct(msRows, pgRows, "SD", asOf, cellRows);
      const dd = drawingStagePct(msRows, pgRows, "DD", asOf, cellRows);
      const cd = drawingStagePct(msRows, pgRows, "CD", asOf, cellRows);
      const overall = drawingOverall(msRows, pgRows, asOf, { sd: 1, dd: 1, cd: 1 }, scope, cellRows);

      // 그룹 셀의 actual(A) = 동일 stage 내 pct' ≤ pct 인 모든 완료 셀의 increment 합 (누계).
      // 셀 데이터가 없으면(레거시) 그룹 단위 fallback (해당 pct 의 group increment).
      const buildCell = (stage: MdrStage, pct: number) => {
        const stageKey = stage === "SD" ? "sd" : stage === "DD" ? "dd" : "cd";
        if (!scope[stageKey]) return null;
        const m = ms.find((x: any) => x.stage === stage && x.pct === pct);
        if (!m) return null;
        const stageCells = cellRows.filter((cc: any) => cc.stage === stage && cc.pct <= pct);
        const stagePg = pgRows.filter((p: any) => p.stage === stage && p.pct <= pct);
        let aShow = 0;
        let actualDate: string | null = null;
        if (stageCells.length) {
          for (const cc of stageCells) {
            const matched = stagePg.find(
              (p: any) => p.pct === cc.pct && (p.subIdx ?? 0) === cc.subIdx && p.isDone,
            );
            if (matched) {
              aShow += cc.incrementPct;
              // 현재 그룹(pct)의 actualDate 만 추적
              if (cc.pct === pct) {
                const raw = pgRaw.find((x: any) =>
                  x.stage === stage && x.pct === pct && Number(x.sub_idx ?? 0) === cc.subIdx && x.is_done,
                );
                const ad = raw?.actual_date ?? null;
                if (ad && (!actualDate || ad > actualDate)) actualDate = ad;
              }
            }
          }
        } else {
          // 레거시 폴백: 그룹 단위 누계
          const stageMs = ms.filter((x: any) => x.stage === stage && x.pct <= pct);
          for (const sm of stageMs) {
            const anyDone = pgRows.find((p: any) => p.stage === stage && p.pct === sm.pct && p.isDone);
            if (anyDone) aShow += Number(sm.increment_pct);
            if (sm.pct === pct && anyDone) {
              const raw = pgRaw.find((x: any) => x.stage === stage && x.pct === pct && x.is_done);
              actualDate = raw?.actual_date ?? null;
            }
          }
        }
        const pShow = drawingMilestonePlannedPct(msRows, stage, pct, asOf);
        return {
          p: pShow,
          a: aShow,
          delta: aShow - pShow,
          planDate: m.plan_date ?? null,
          actualDate,
        };
      };

      const sdCells: MdrDrawingRow["sdCells"] = {};
      SD_PCTS.forEach((p) => { sdCells[p] = buildCell("SD", p); });
      const ddCells: MdrDrawingRow["ddCells"] = {};
      DD_PCTS.forEach((p) => { ddCells[p] = buildCell("DD", p); });
      const cdCells: MdrDrawingRow["cdCells"] = {};
      CD_PCTS.forEach((p) => { cdCells[p] = buildCell("CD", p); });

      const progressIconCells = buildMdrProgressIconCells(ms, pgRaw, asOf, scope, cellRows);

      // [TEMP DIAG] DD A 표시 회귀 진단용 — 확인 후 제거 예정
      if (d.discipline === "AR" && String(d.source_no) === "1" && d.building_code === "SMP&CCM") {
        // eslint-disable-next-line no-console
        console.debug("[mdr-diag] SMP&CCM/AR/No.1", JSON.stringify({
          ddActual: dd.actual,
          ddPlanned: dd.planned,
          ddDelta: dd.delta,
          ddCells,
          cellRowsLen: cellRows.length,
          pgRowsLen: pgRows.length,
        }));
      }

      return {
        id: d.id,
        source_no: d.source_no,
        building_code: d.building_code,
        item_no: d.item_no,
        doc_no: d.doc_no ?? null,
        doc_base: d.doc_base ?? null,
        rev: d.rev ?? null,
        discipline: d.discipline,
        plant_id: d.plant_id ?? null,
        pbs: d.pbs ?? null,
        fbs: d.fbs ?? null,
        ser_no: d.ser_no ?? null,
        missing_plant_id: !!d.missing_plant_id,
        missing_pbs: !!d.missing_pbs,
        missing_fbs: !!d.missing_fbs,
        missing_ser_no: !!d.missing_ser_no,
        activity_group: d.activity_group ?? null,
        drawing_title: d.drawing_title,
        plan_finish: d.plan_finish,
        updated_at: d.updated_at,
        confirmed_by: (d as any).confirmed_by ?? null,
        ifr_start_date: (d as any).ifr_start_date ?? null,
        ifr_issue_date: (d as any).ifr_issue_date ?? null,
        ifc_start_date: (d as any).ifc_start_date ?? null,
        ifc_issue_date: (d as any).ifc_issue_date ?? null,
        document_class: (d as any).document_class ?? null,
        doc_class_code: (d as any).doc_class_code ?? null,
        stage_plan_sd: (d as any).stage_plan_sd ?? null,
        stage_plan_dd: (d as any).stage_plan_dd ?? null,
        stage_plan_cd: (d as any).stage_plan_cd ?? null,
        sd_mark: scope.sd ? "O" : "-",
        dd_mark: scope.dd ? "O" : "-",
        cd_mark: scope.cd ? "O" : "-",
        sd_p: scope.sd ? sd.planned : null,
        sd_a: scope.sd ? sd.actual : null,
        sd_d: scope.sd ? sd.delta : null,
        dd_p: scope.dd ? dd.planned : null,
        dd_a: scope.dd ? dd.actual : null,
        dd_d: scope.dd ? dd.delta : null,
        cd_p: scope.cd ? cd.planned : null,
        cd_a: scope.cd ? cd.actual : null,
        cd_d: scope.cd ? cd.delta : null,
        overall_p: overall.planned,
        overall_a: overall.actual,
        overall_d: overall.actual - overall.planned,
        sdCells,
        ddCells,
        cdCells,
        progressIconCells,
        raw_row_cells: (d as any).raw_row_cells ?? null,
        _raw: d,
      };
    });
  }, [data, asOf]);

  // 자연 정렬 기본 순서: discipline → source_no (numeric)
  const sortedRows = useMemo(() => {
    const cmp = (a: string | null, b: string | null) =>
      String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return [...rows].sort((a, b) => cmp(a.discipline, b.discipline) || cmp(a.source_no, b.source_no));
  }, [rows]);

  // Δ = Actual − Planned. 음수 = 공정지연(빨강), 양수 = 선행(파랑), 0 = 기본
  const deltaCls = (delta: number) => {
    if (delta < 0) return "text-destructive font-semibold";
    if (delta > 0) return "text-blue-600 dark:text-blue-400 font-semibold";
    return "text-muted-foreground";
  };

  // 영속화 (rowSelection 제외) — 컬럼 빌드 전에 먼저 읽어 groupCollapsed 초기화에 사용
  const persistKey = user ? `mdr-raw-grid-state:${user.id}:${buildingCode}:${sheetName ?? "all"}` : null;
  const [persisted, setPersisted] = useGridStatePersistence(persistKey);

  const [groupCollapsed, setGroupCollapsed] = useState<{ dd: boolean; cd: boolean }>(
    () => persisted.groupCollapsed ?? { dd: false, cd: false },
  );
  const onToggleGroup = (g: ProgressGroup) =>
    setGroupCollapsed((s) => ({ ...s, [g]: !s[g] }));

  const columns = useMemo(
    () => buildMdrColumns(deltaCls, { collapsed: groupCollapsed, onToggleGroup, asOf }),
    [threshold, groupCollapsed, asOf],
  );

  // 모든 컬럼 id (그룹/leaf 모두) — pruneById/Record 가 그룹 컬럼 id 도 보존하도록.
  const validColumnIds = useMemo(() => {
    const set = new Set<string>();
    const walk = (defs: any[]) => {
      for (const c of defs) {
        const id = c.id ?? c.accessorKey;
        if (id) set.add(id);
        if (c.columns) walk(c.columns);
      }
    };
    walk(columns as any[]);
    return set;
  }, [columns]);

  // leaf 컬럼 id 의 기본 순서 (TanStack columnOrder 용)
  const defaultLeafOrder = useMemo(() => {
    const ids: string[] = [];
    const walk = (defs: any[]) => {
      for (const c of defs) {
        if (c.columns) walk(c.columns);
        else {
          const id = c.id ?? c.accessorKey;
          if (id) ids.push(id);
        }
      }
    };
    walk(columns as any[]);
    return ids;
  }, [columns]);

  const pruneById = <T extends { id: string }>(arr: T[]) => arr.filter((x) => validColumnIds.has(x.id));
  const pruneRecord = <T,>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([k]) => validColumnIds.has(k))) as Record<string, T>;

  const [sorting, setSorting] = useState<SortingState>(() => pruneById(persisted.sorting));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => pruneById(persisted.columnFilters));
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => pruneRecord(persisted.columnSizing));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const cleaned = pruneRecord(persisted.columnVisibility);
    // 최초 1회 기본값: mark 컬럼 + SD 단계 트리오 + 세부 마일스톤 P/A/Δ + 부가 메타 컬럼은 숨김
    const defaults: VisibilityState = {};
    if (!("sd_mark" in cleaned)) defaults.sd_mark = false;
    if (!("dd_mark" in cleaned)) defaults.dd_mark = false;
    if (!("cd_mark" in cleaned)) defaults.cd_mark = false;
    // SD 단계 트리오 기본 숨김 (항상 100/100/0)
    for (const id of ["sd_p", "sd_a", "sd_d"]) {
      if (!(id in cleaned)) defaults[id] = false;
    }
    const EXTRA_META = [
      "confirmed_by", "document_class", "doc_class_code",
      "ifr_start_date", "ifr_issue_date", "ifc_start_date", "ifc_issue_date",
    ];
    for (const id of EXTRA_META) {
      if (!(id in cleaned)) defaults[id] = false;
    }
    for (const id of defaultLeafOrder) {
      if (/^(sd|dd|cd)_\d+_(p|a|d|pd|ad)$/.test(id) && !(id in cleaned)) {
        defaults[id] = false;
      }
    }
    return { ...defaults, ...cleaned };
  });
  // 사용자별 컬럼 순서 (leaf id 만). 빈 배열이면 기본 순서 사용.
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    sanitizeColumnOrder(persisted.columnOrder ?? [], defaultLeafOrder),
  );
  // 컬럼 정의가 바뀌면 (신규 컬럼 추가/제거) 순서 재정규화
  useEffect(() => {
    setColumnOrder((prev) => sanitizeColumnOrder(prev, defaultLeafOrder));
  }, [defaultLeafOrder]);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobal, setDebouncedGlobal] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobal(globalFilter), 200);
    return () => clearTimeout(t);
  }, [globalFilter]);

  useEffect(() => {
    setPersisted({ sorting, columnFilters, columnSizing, columnVisibility, groupCollapsed, columnOrder });
  }, [sorting, columnFilters, columnSizing, columnVisibility, groupCollapsed, columnOrder, setPersisted]);

  const table = useReactTable({
    data: sortedRows,
    columns,
    state: { sorting, columnFilters, columnSizing, columnVisibility, columnOrder, rowSelection, globalFilter: debouncedGlobal },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder as any,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (r) => r.id,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    globalFilterFn: (row, _id, value) => {
      if (!value) return true;
      const v = String(value).toLowerCase();
      const r = row.original;
      return [r.source_no, r.item_no, r.doc_no, r.drawing_title, r.discipline, r.building_code]
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

  const exportFilteredXlsx = async () => {
    try {
      const XLSX: any = await import(/* @vite-ignore */ "xlsx").catch(() => null);
      if (!XLSX) {
        toast({ title: "xlsx 라이브러리 누락", variant: "destructive" });
        return;
      }
      const { formatPct } = await import("./filterFns");
      const cols = visibleLeafColumns.filter((c) => c.id !== "__select__");

      // 그리드의 헤더 라벨과 동일하게 매핑 (마일스톤 컬럼 포함)
      const headerLabel = (id: string, fallback: string): string => {
        const base: Record<string, string> = {
          source_no: "No.", building_code: "Building", doc_no: "Doc No.", item_no: "Item No.",
          discipline: "Disc.", drawing_title: "Title",
          sd_mark: "SD", dd_mark: "DD", cd_mark: "CD",
          sd_p: "SD P", sd_a: "SD A", sd_d: "SD Δ",
          dd_p: "DD P", dd_a: "DD A", dd_d: "DD Δ",
          cd_p: "CD P", cd_a: "CD A", cd_d: "CD Δ",
          overall_p: "Overall P", overall_a: "Overall A", overall_d: "Overall Δ",
          stage_plan_sd: "SD목표완료일",
          stage_plan_dd: "DD목표완료일",
          stage_plan_cd: "CD목표완료일",
          plan_finish: "Plan Finish", updated_at: "Updated",
          progress_icon: "Progress",
        };
        if (base[id]) return base[id];
        // 세부 마일스톤: sd_100_p / dd_30_a / cd_100_d / dd_60_pd / dd_60_ad → "DD60 계획일" 등
        const m = id.match(/^(sd|dd|cd)_(\d+)_(pd|ad|p|a|d)$/);
        if (m) {
          const sfx = m[3];
          const suffix =
            sfx === "pd" ? "계획일" :
            sfx === "ad" ? "실적일" :
            sfx === "d" ? "Δ" : sfx.toUpperCase();
          return `${m[1].toUpperCase()}${m[2]} ${suffix}`;
        }
        return fallback;
      };

      // 그리드 셀 렌더와 동일한 표시 문자열로 변환
      const formatCell = (id: string, value: any): any => {
        if (id === "progress_icon") {
          const arr = Array.isArray(value) ? value : [];
          if (arr.length < 8) return "";
          const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const summ = (slice: string[]) => {
            const order = ["delay", "wip", "planned", "done", "empty"];
            const found = order.find((o) => slice.includes(o)) ?? "empty";
            return cap(found);
          };
          return `SD:${cap(arr[0])}|DD:${summ(arr.slice(1, 5))}|CD:${summ(arr.slice(5, 8))}`;
        }
        if (/^(sd|dd|cd|overall)_(p|a|d)$/.test(id)) {
          if (value == null) return "-";
          return Math.round(Number(value));
        }
        if (id === "sd_mark" || id === "dd_mark" || id === "cd_mark") {
          return (value as string) || "-";
        }
        if (id === "plan_finish") {
          return (value as string) ?? "-";
        }
        if (id === "updated_at") {
          const v = value as string | null;
          return v ? v.slice(0, 16).replace("T", " ") : "-";
        }
        // 마일스톤 날짜 컬럼
        if (/^(sd|dd|cd)_\d+_(pd|ad)$/.test(id)) {
          const v = value as string | null;
          return v ? v.slice(0, 10) : "-";
        }
        // 마일스톤 분리 컬럼: null이면 "-", 숫자면 반올림
        if (/^(sd|dd|cd)_\d+_(p|a|d)$/.test(id)) {
          if (value == null) return "-";
          return Math.round(Number(value));
        }
        return value ?? "";
      };

      const header = cols.map((c) =>
        headerLabel(c.id, typeof c.columnDef.header === "string" ? (c.columnDef.header as string) : c.id),
      );
      const aoa: any[][] = [header];
      for (const r of tableRows) {
        aoa.push(cols.map((c) => formatCell(c.id, r.getValue(c.id))));
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // 그리드의 컬럼 폭(px → Excel 문자단위 ≈ /7)을 근사 반영
      ws["!cols"] = cols.map((c) => ({ wch: Math.max(8, Math.round(c.getSize() / 7)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MDR");
      const fname = `mdr_${buildingCode}${sheetName ? `_${sheetName}` : ""}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast({ title: "Export 완료", description: `${tableRows.length}행 / ${cols.length}열` });
    } catch (e: any) {
      toast({ title: "Export 실패", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  // Template 원본 파일 존재 여부 — 활성/비활성 결정
  const [templateAvailable, setTemplateAvailable] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: signed, error } = await supabase.storage
          .from("mdr-templates")
          .createSignedUrl(`${buildingCode}/template.xlsx`, 30);
        if (!cancelled) setTemplateAvailable(!error && !!signed?.signedUrl);
      } catch {
        if (!cancelled) setTemplateAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, [buildingCode]);

  const exportTemplateXlsx = async () => {
    try {
      if (!data || !data.length) {
        toast({ title: "Export 실패", description: "데이터가 없습니다.", variant: "destructive" });
        return;
      }
      // 1) 원본 워크북 다운로드
      const { data: blob, error: dErr } = await supabase.storage
        .from("mdr-templates")
        .download(`${buildingCode}/template.xlsx`);
      if (dErr || !blob) {
        toast({
          title: "원본 양식 없음",
          description: "이 건물에 저장된 임포트 원본이 없습니다. 다시 임포트해주세요.",
          variant: "destructive",
        });
        return;
      }
      const ab = await blob.arrayBuffer();

      // 2) DB → MdrExportDrawing[] 매핑 (전체 데이터, 필터/정렬 무시)
      const { exportFromTemplate } = await import("@/lib/mdr/exporter");
      const drawings = (data as any[]).map((d) => {
        const pg = (d.mdr_progress ?? []) as any[];
        const progress: Record<string, boolean> = {};
        for (const p of pg) {
          if (p.is_done) progress[`${p.stage}-${Number(p.pct)}`] = true;
        }
        return {
          sourceNo: d.source_no,
          building: d.building_code,
          itemNo: d.item_no ?? "",
          discipline: d.discipline ?? "",
          plantId: d.plant_id ?? "",
          pbs: d.pbs ?? "",
          fbs: d.fbs ?? "",
          serNo: d.ser_no ?? "",
          activityGroup: d.activity_group ?? "",
          drawingTitle: d.drawing_title ?? "",
          outOfScope: !!d.out_of_scope,
          confirmedBy: d.confirmed_by ?? null,
          ifrStartDate: d.ifr_start_date ?? null,
          ifrIssueDate: d.ifr_issue_date ?? null,
          ifcStartDate: d.ifc_start_date ?? null,
          ifcIssueDate: d.ifc_issue_date ?? null,
          documentClass: d.document_class ?? null,
          docClassCode: d.doc_class_code ?? null,
          stagePlanSd: d.stage_plan_sd ?? null,
          stagePlanDd: d.stage_plan_dd ?? null,
          stagePlanCd: d.stage_plan_cd ?? null,
          rev: d.rev ?? "",
          rawRowCells: d.raw_row_cells ?? null,
          progress,
        };
      });

      const out = exportFromTemplate(ab, drawings);
      const fname = `mdr_template_${buildingCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Template Export 완료", description: `${drawings.length}건` });
    } catch (e: any) {
      toast({ title: "Export 실패", description: e?.message ?? String(e), variant: "destructive" });
    }
  };


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

        <div className="ml-auto flex items-center gap-2">
          <MdrProgressIconLegend />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Download className="mr-1 h-3.5 w-3.5" />Export<ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportFilteredXlsx}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Raw Data 내보내기
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={exportTemplateXlsx}
              disabled={!templateAvailable}
              title={templateAvailable ? "임포트한 엑셀 양식 그대로 내보냅니다" : "원본 양식이 저장된 임포트가 없습니다. 다시 임포트해주세요."}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Template로 내보내기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs"><Settings2 className="mr-1 h-3.5 w-3.5" />Columns</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-2 max-h-96 overflow-auto">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-medium text-muted-foreground">컬럼 표시</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:underline"
                  onClick={() => table.getAllLeafColumns().filter((c) => c.id !== "__select__").forEach((c) => c.toggleVisibility(true))}
                >
                  전체
                </button>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:underline"
                  onClick={() => table.getAllLeafColumns().filter((c) => c.id !== "__select__").forEach((c) => c.toggleVisibility(false))}
                >
                  해제
                </button>
              </div>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => setColumnOrder(defaultLeafOrder)}
              title="드래그로 변경한 컬럼 순서를 기본값으로 되돌립니다"
            >
              <RotateCcw className="h-3 w-3" /> 컬럼 순서 초기화
            </button>
            <div className="my-1 h-px bg-border" />
            {table.getAllLeafColumns().filter((c) => c.id !== "__select__").map((col) => (
              <label
                key={col.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50"
              >
                <Checkbox
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 truncate">
                  {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                </span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <TopHorizontalScrollbar targetRef={tableRef} width={totalWidth} />

      {/* 본문 — 헤더/본문이 동일 <table> 안에서 같은 가로 스크롤 좌표계를 공유 */}
      <div ref={tableRef} className="relative max-h-[70vh] overflow-auto">
        {(() => {
          const virtualItems = rowVirtualizer.getVirtualItems();
          const totalSize = rowVirtualizer.getTotalSize();
          const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
          const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
          const leafCount = visibleLeafColumns.length;
          const leafIds = visibleLeafColumns.map((c) => c.id);
          return (
            <table className="text-xs" style={{ width: totalWidth, tableLayout: "fixed" }}>
              <colgroup>
                {visibleLeafColumns.map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <DndHeaderContext
                leafIds={leafIds}
                onReorder={(activeId, overId) => {
                  if (activeId === overId) return;
                  if (activeId === "__select__" || overId === "__select__") return;
                  // 그룹 가드 제거: sanitizeColumnOrder 가 그룹 leaf 를 자동으로 인접 배치하므로
                  // 1단/2단 간 자유 이동을 허용한다.
                  setColumnOrder((prev) => {
                    const base = prev.length ? prev : defaultLeafOrder;
                    const next = [...base];
                    const from = next.indexOf(activeId);
                    const to = next.indexOf(overId);
                    if (from < 0 || to < 0) return prev;
                    next.splice(from, 1);
                    next.splice(to, 0, activeId);
                    return sanitizeColumnOrder(next, defaultLeafOrder);
                  });
                }}
              >
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => {
                        if (header.isPlaceholder) {
                          // placeholder — 같은 leaf 가 부모 행에도 표시되는 경우. 빈 셀로 colSpan 처리.
                          return (
                            <th
                              key={header.id}
                              colSpan={header.colSpan}
                              style={{ position: "sticky", top: 0, zIndex: 3, background: "hsl(var(--primary) / 0.12)" }}
                              className="border-r border-b border-primary/30"
                            />
                          );
                        }
                        const isLeaf = header.subHeaders.length === 0;
                        return (
                          <SortableHeaderCell
                            key={header.id}
                            header={header}
                            isLeaf={isLeaf}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </thead>
              </DndHeaderContext>
              <tbody>
                {paddingTop > 0 && (
                  <tr aria-hidden style={{ height: paddingTop }}>
                    <td colSpan={leafCount} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualItems.map((vrow) => {
                  const row = tableRows[vrow.index];
                  return (
                    <tr
                      key={row.id}
                      data-index={vrow.index}
                      className={cn("border-t hover:bg-muted/30", row.getIsSelected() && "bg-primary/10")}
                      style={{ height: vrow.size }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const w = cell.column.getSize();
                        return (
                          <td
                            key={cell.id}
                            style={{ width: w, minWidth: w, maxWidth: w, overflow: "hidden" }}
                            className="border-r px-2 py-1 truncate whitespace-nowrap"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden style={{ height: paddingBottom }}>
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


