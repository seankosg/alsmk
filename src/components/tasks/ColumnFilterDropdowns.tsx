/**
 * Shared column filter dropdowns + filter functions for Task tables.
 * Ported from SHAW PROJECT CMS Defect Raw Data column filter UX.
 */
import { useMemo } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const EMPTY_TOKEN = "__EMPTY__";

export type ColumnFilterValue =
  | { type: "multi"; values: string[] }
  | { type: "text"; text?: string; emptyOnly?: boolean }
  | { type: "date"; from?: string; to?: string; emptyOnly?: boolean }
  | undefined;

export type ColumnFiltersState = Record<string, ColumnFilterValue>;

// ─── Token helpers (comma = AND) ────────────────────────────────────────────
export const tokenizeAnd = (text: string): string[] =>
  String(text ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

export const matchesAllTokens = (haystack: string, query: string): boolean => {
  const tokens = tokenizeAnd(query);
  if (tokens.length === 0) return true;
  const lower = String(haystack ?? "").toLowerCase();
  return tokens.every((tok) => lower.includes(tok));
};

// ─── Filter evaluators ─────────────────────────────────────────────────────
export function evalMulti(val: any, f: Extract<ColumnFilterValue, { type: "multi" }>): boolean {
  if (!f.values?.length) return true;
  const isEmpty = val == null || val === "";
  if (f.values.includes(EMPTY_TOKEN) && isEmpty) return true;
  if (isEmpty) return false;
  return f.values.includes(String(val));
}

export function evalText(val: any, f: Extract<ColumnFilterValue, { type: "text" }>): boolean {
  if (f.emptyOnly) return val == null || String(val).trim() === "";
  if (!f.text) return true;
  if (val == null) return false;
  return matchesAllTokens(String(val), String(f.text));
}

export function evalDate(val: any, f: Extract<ColumnFilterValue, { type: "date" }>): boolean {
  if (f.emptyOnly) return val == null || val === "";
  if (!f.from && !f.to) return true;
  if (!val) return false;
  const iso = String(val).slice(0, 10);
  if (f.from && iso < f.from) return false;
  if (f.to && iso > f.to) return false;
  return true;
}

export function evalFilter(val: any, f: ColumnFilterValue): boolean {
  if (!f) return true;
  if (f.type === "multi") return evalMulti(val, f);
  if (f.type === "text") return evalText(val, f);
  if (f.type === "date") return evalDate(val, f);
  return true;
}

export function isFilterActive(f: ColumnFilterValue): boolean {
  if (!f) return false;
  if (f.type === "multi") return (f.values?.length ?? 0) > 0;
  if (f.type === "text") return !!(f.text || f.emptyOnly);
  if (f.type === "date") return !!(f.from || f.to || f.emptyOnly);
  return false;
}

// ─── Dropdown components ───────────────────────────────────────────────────
interface CommonProps {
  value: ColumnFilterValue;
  onChange: (v: ColumnFilterValue) => void;
}

export function MultiSelectDropdown({
  value,
  onChange,
  options,
  facets,
}: CommonProps & {
  options: { value: string; label: string }[];
  facets?: Map<any, number>;
}) {
  const selected = value?.type === "multi" ? value.values : [];
  const isActive = selected.length > 0;
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.length ? { type: "multi", values: next } : undefined);
  };

  const labelMap = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);

  const items = useMemo(() => {
    const counts = new Map<string, number>();
    let emptyCount = 0;
    if (facets) {
      facets.forEach((count, rawVal) => {
        if (rawVal == null || rawVal === "") {
          emptyCount += count;
        } else {
          const key = String(rawVal);
          counts.set(key, (counts.get(key) ?? 0) + count);
        }
      });
    }
    selected.forEach((v) => { if (v !== EMPTY_TOKEN && !counts.has(v)) counts.set(v, 0); });
    options.forEach((o) => { if (!counts.has(o.value)) counts.set(o.value, 0); });

    const list = [...counts.entries()].map(([v, count]) => ({
      value: v,
      label: labelMap.get(v) ?? v,
      count,
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return [{ value: EMPTY_TOKEN, label: "(Empty)", count: emptyCount }, ...list];
  }, [facets, options, labelMap, selected]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80",
            isActive ? "text-primary" : "text-muted-foreground/50",
          )}
          onClick={(e) => e.stopPropagation()}
          title="Filter"
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-72 w-56 overflow-auto p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 px-1">
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:underline"
            onClick={() => onChange({ type: "multi", values: items.map((o) => o.value) })}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:underline"
            onClick={() => onChange(undefined)}
          >
            Clear all
          </button>
        </div>
        {items.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50",
              option.count === 0 && !selected.includes(option.value) && "text-muted-foreground/60",
            )}
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
              className="h-3.5 w-3.5"
            />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{option.count}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function TextFilterDropdown({ value, onChange }: CommonProps) {
  const text = value?.type === "text" ? value.text ?? "" : "";
  const emptyOnly = value?.type === "text" ? !!value.emptyOnly : false;
  const isActive = !!(text || emptyOnly);

  const update = (patch: Partial<{ text: string; emptyOnly: boolean }>) => {
    const current = value?.type === "text" ? value : { type: "text" as const };
    const next = { ...current, ...patch };
    onChange(next.text || next.emptyOnly ? { type: "text", text: next.text, emptyOnly: next.emptyOnly } : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80",
            isActive ? "text-primary" : "text-muted-foreground/50",
          )}
          onClick={(e) => e.stopPropagation()}
          title="Filter"
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 space-y-2 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            className="text-[11px] text-muted-foreground/40 cursor-not-allowed"
            disabled
            title="Not applicable for text filters"
          >
            Select all
          </button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:underline"
            onClick={() => onChange(undefined)}
          >
            Clear all
          </button>
        </div>
        <Input
          placeholder="Search... (use , for AND)"
          value={text}
          onChange={(e) => update({ text: e.target.value || undefined })}
          className="h-7 text-xs"
          disabled={emptyOnly}
        />
        <p className="text-[10px] text-muted-foreground">
          Tip: comma separates AND terms (e.g. <code>slab, rebar</code>)
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={emptyOnly}
            onCheckedChange={(checked) => update({ emptyOnly: !!checked, text: undefined })}
            className="h-3.5 w-3.5"
          />
          Empty only
        </label>
      </PopoverContent>
    </Popover>
  );
}

export function DateRangeDropdown({ value, onChange }: CommonProps) {
  const v = value?.type === "date" ? value : undefined;
  const isActive = !!(v?.from || v?.to || v?.emptyOnly);

  const update = (patch: Partial<{ from?: string; to?: string; emptyOnly?: boolean }>) => {
    const current = v ?? { type: "date" as const };
    const next = { ...current, ...patch };
    onChange(next.from || next.to || next.emptyOnly ? { type: "date", from: next.from, to: next.to, emptyOnly: next.emptyOnly } : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/80",
            isActive ? "text-primary" : "text-muted-foreground/50",
          )}
          onClick={(e) => e.stopPropagation()}
          title="Filter"
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 space-y-2 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            className="text-[11px] text-muted-foreground/40 cursor-not-allowed"
            disabled
            title="Not applicable for date filters"
          >
            Select all
          </button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:underline"
            onClick={() => onChange(undefined)}
          >
            Clear all
          </button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">From</label>
          <Input
            type="date"
            value={v?.from ?? ""}
            onChange={(e) => update({ from: e.target.value || undefined })}
            className="h-7 text-xs"
            disabled={!!v?.emptyOnly}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">To</label>
          <Input
            type="date"
            value={v?.to ?? ""}
            onChange={(e) => update({ to: e.target.value || undefined })}
            className="h-7 text-xs"
            disabled={!!v?.emptyOnly}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
          <Checkbox
            checked={!!v?.emptyOnly}
            onCheckedChange={(checked) => update({ emptyOnly: !!checked, from: undefined, to: undefined })}
            className="h-3.5 w-3.5"
          />
          Empty only
        </label>
      </PopoverContent>
    </Popover>
  );
}

export type ColumnFilterType = "text" | "multi" | "date";

export function ColumnFilterDropdown(props: {
  type: ColumnFilterType;
  value: ColumnFilterValue;
  onChange: (v: ColumnFilterValue) => void;
  options?: { value: string; label: string }[];
  facets?: Map<any, number>;
}) {
  if (props.type === "multi") {
    return (
      <MultiSelectDropdown
        value={props.value}
        onChange={props.onChange}
        options={props.options ?? []}
        facets={props.facets}
      />
    );
  }
  if (props.type === "date") {
    return <DateRangeDropdown value={props.value} onChange={props.onChange} />;
  }
  return <TextFilterDropdown value={props.value} onChange={props.onChange} />;
}
