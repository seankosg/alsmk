import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { CandidateActivity, ScoredCandidate } from "./OrphanRecommender";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  candidates: CandidateActivity[];
  recommendations: ScoredCandidate[];
  disabled?: boolean;
  className?: string;
}

function formatLabel(c: CandidateActivity): string {
  const cf = c.custom_fields || {};
  const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"] || "";
  const parts = (c.wbs_full || "").split(".");
  const wbsL2 = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] || "";
  return [bldg, wbsL2, c.name].filter(Boolean).join(" · ");
}

export function NewActivityCombobox({
  value, onChange, candidates, recommendations, disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => candidates.find((c) => c.id === value) || null,
    [candidates, value],
  );

  const recIds = useMemo(() => new Set(recommendations.map((r) => r.candidate.id)), [recommendations]);
  const others = useMemo(
    () => candidates.filter((c) => !recIds.has(c.id)),
    [candidates, recIds],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("h-8 w-full justify-between text-xs font-normal", className)}
        >
          <span className="truncate text-left">
            {selected ? formatLabel(selected) : "신규 Activity 선택..."}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-2">
            <Search className="h-3.5 w-3.5 opacity-50 mr-1" />
            <CommandInput placeholder="이름 · WBS · BLDG 검색..." className="h-9 text-xs" />
          </div>
          <CommandList className="max-h-[320px]">
            <CommandEmpty>일치 항목이 없습니다</CommandEmpty>

            {recommendations.length > 0 && (
              <>
                <CommandGroup heading="추천">
                  {recommendations.map(({ candidate, score }) => (
                    <CommandItem
                      key={`rec-${candidate.id}`}
                      value={`rec ${formatLabel(candidate)}`}
                      onSelect={() => {
                        onChange(candidate.id);
                        setOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5",
                        value === candidate.id ? "opacity-100" : "opacity-0")} />
                      <span className="truncate flex-1">{formatLabel(candidate)}</span>
                      <Badge
                        variant={score >= 95 ? "default" : "outline"}
                        className="ml-2 text-[10px] px-1.5 py-0"
                      >
                        {score}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="전체 Activity">
              {others.map((c) => (
                <CommandItem
                  key={c.id}
                  value={formatLabel(c)}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5",
                    value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{formatLabel(c)}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="기타">
              <CommandItem
                value="__unmap__"
                onSelect={() => { onChange(null); setOpen(false); }}
                className="text-xs text-destructive"
              >
                <X className="mr-2 h-3.5 w-3.5" />
                매핑 해제 (Task에서 이 Activity 매핑 제거)
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
