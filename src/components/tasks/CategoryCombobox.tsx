import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CategoryCombobox({ value, onChange, placeholder = "Select or type category" }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["task-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("category")
        .not("category", "is", null)
        .order("category");
      const unique = [...new Set((data ?? []).map(d => d.category).filter(Boolean))] as string[];
      return unique;
    },
    staleTime: 30_000,
  });

  const filtered = search
    ? categories.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const showCreateOption = search && !categories.some(c => c.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup>
              {filtered.map(cat => (
                <CommandItem
                  key={cat}
                  value={cat}
                  onSelect={() => {
                    onChange(cat);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === cat ? "opacity-100" : "opacity-0")} />
                  {cat}
                </CommandItem>
              ))}
              {showCreateOption && (
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={() => {
                    onChange(search);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &quot;{search}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { Plus } from "lucide-react";
