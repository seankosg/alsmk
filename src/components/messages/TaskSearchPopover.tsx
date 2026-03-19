import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

interface TaskSearchPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTask: (taskId: string) => void;
  children: React.ReactNode;
}

export function TaskSearchPopover({ open, onOpenChange, onSelectTask, children }: TaskSearchPopoverProps) {
  const [search, setSearch] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, task_code, title")
        .order("task_code");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? tasks.filter(
        (t) =>
          t.task_code?.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
      )
    : tasks;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No tasks found</p>
            )}
            {filtered.slice(0, 50).map((t) => (
              <button
                key={t.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-accent/50 text-sm"
                onClick={() => onSelectTask(t.id)}
              >
                <span className="font-mono text-xs text-muted-foreground">{t.task_code}</span>
                <span className="block truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
