import { useMemo } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EMPTY_TOKEN } from "./filterFns";

function MultiSelectDropdown({ column, options }: { column: any; options: { value: string; label: string }[] }) {
  const selected: string[] = (column.getFilterValue() as string[]) ?? [];
  const isActive = selected.length > 0;
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    column.setFilterValue(next.length ? next : undefined);
  };
  const labelMap = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const facets = column.getFacetedUniqueValues?.() as Map<any, number> | undefined;

  const items = useMemo(() => {
    const counts = new Map<string, number>();
    let emptyCount = 0;
    if (facets) {
      facets.forEach((count, rawVal) => {
        if (rawVal == null || rawVal === "") emptyCount += count;
        else {
          const key = String(rawVal);
          counts.set(key, (counts.get(key) ?? 0) + count);
        }
      });
    }
    selected.forEach((v) => { if (v !== EMPTY_TOKEN && !counts.has(v)) counts.set(v, 0); });
    options.forEach((o) => { if (!counts.has(o.value)) counts.set(o.value, 0); });
    const list = [...counts.entries()].map(([value, count]) => ({
      value, label: String(labelMap.get(value) ?? value), count,
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return [{ value: EMPTY_TOKEN, label: "(Empty)", count: emptyCount }, ...list];
  }, [facets, options, labelMap, selected]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn("inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80", isActive ? "text-primary" : "text-muted-foreground/50")}
          onClick={(e) => e.stopPropagation()}
          title="Filter"
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-56 overflow-auto p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2 px-1">
          <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => column.setFilterValue(items.map((o) => o.value))}>Select all</button>
          <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => column.setFilterValue(undefined)}>Clear all</button>
        </div>
        {items.map((option) => (
          <label key={option.value} className={cn("flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50", option.count === 0 && !selected.includes(option.value) && "text-muted-foreground/60")}>
            <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)} className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{option.count}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TextFilterDropdown({ column }: { column: any }) {
  const filterValue = column.getFilterValue() as { text?: string; emptyOnly?: boolean } | string | undefined;
  const text = typeof filterValue === "string" ? filterValue : filterValue?.text ?? "";
  const emptyOnly = typeof filterValue === "object" ? filterValue?.emptyOnly ?? false : false;
  const isActive = !!(text || emptyOnly);
  const update = (patch: Partial<{ text: string; emptyOnly: boolean }>) => {
    const current = typeof filterValue === "string" ? { text: filterValue, emptyOnly: false } : filterValue ?? { text: "", emptyOnly: false };
    const next = { ...current, ...patch };
    column.setFilterValue(next.text || next.emptyOnly ? next : undefined);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80", isActive ? "text-primary" : "text-muted-foreground/50")} onClick={(e) => e.stopPropagation()} title="Filter">
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 space-y-2 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => column.setFilterValue(undefined)}>Clear all</button>
        <Input placeholder="Search... (use , for AND)" value={text} onChange={(e) => update({ text: e.target.value || undefined })} className="h-7 text-xs" disabled={emptyOnly} />
        <p className="text-[10px] text-muted-foreground">Tip: comma separates AND terms</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox checked={emptyOnly} onCheckedChange={(c) => update({ emptyOnly: !!c, text: undefined })} className="h-3.5 w-3.5" />
          Empty only
        </label>
      </PopoverContent>
    </Popover>
  );
}

function DateRangeDropdown({ column }: { column: any }) {
  const filterValue = column.getFilterValue() as { from?: string; to?: string; emptyOnly?: boolean } | undefined;
  const isActive = !!(filterValue?.from || filterValue?.to || filterValue?.emptyOnly);
  const update = (patch: Partial<{ from: string; to: string; emptyOnly: boolean }>) => {
    const next = { ...(filterValue ?? {}), ...patch };
    column.setFilterValue(next.from || next.to || next.emptyOnly ? next : undefined);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80", isActive ? "text-primary" : "text-muted-foreground/50")} onClick={(e) => e.stopPropagation()} title="Filter">
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => column.setFilterValue(undefined)}>Clear all</button>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">From</label>
          <Input type="date" value={filterValue?.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} className="h-7 text-xs" disabled={!!filterValue?.emptyOnly} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">To</label>
          <Input type="date" value={filterValue?.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} className="h-7 text-xs" disabled={!!filterValue?.emptyOnly} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
          <Checkbox checked={!!filterValue?.emptyOnly} onCheckedChange={(c) => update({ emptyOnly: !!c, from: undefined, to: undefined })} className="h-3.5 w-3.5" />
          Empty only
        </label>
      </PopoverContent>
    </Popover>
  );
}

export function ColumnFilterDropdown({ column }: { column: any }) {
  const meta = column.columnDef.meta as any;
  if (meta?.filterType === "multi-select") return <MultiSelectDropdown column={column} options={meta.filterOptions ?? []} />;
  if (meta?.filterType === "date-range") return <DateRangeDropdown column={column} />;
  return <TextFilterDropdown column={column} />;
}
