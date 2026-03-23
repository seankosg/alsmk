import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  taskId: string;
  taskTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MapActivitiesDialog({ taskId, taskTitle, open, onOpenChange }: Props) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Get existing mappings for this task
  const { data: existingMappings = [] } = useQuery({
    queryKey: ["cpm_task_activity_mappings", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_task_mappings")
        .select("activity_id")
        .eq("task_id", taskId);
      return (data || []).map(d => d.activity_id);
    },
    enabled: open,
  });

  // Get all CPM activities
  const { data: allActivities = [] } = useQuery({
    queryKey: ["all_cpm_activities_for_mapping"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_activities")
        .select("id, name, wbs_full, mpp_task_id, duration, progress, is_critical, is_milestone")
        .order("wbs_full");
      return data || [];
    },
    enabled: open,
  });

  // Initialize selected when mappings load
  if (open && existingMappings.length > 0 && !initialized) {
    setSelectedIds(new Set(existingMappings));
    setInitialized(true);
  }

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      setSelectedIds(new Set(existingMappings));
      setSearch("");
      setInitialized(true);
    } else {
      setInitialized(false);
    }
  };

  const filtered = allActivities.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.wbs_full || "").toLowerCase().includes(q) ||
      (a.mpp_task_id || "").toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Remove old mappings for this task
      await supabase.from("cpm_task_mappings").delete().eq("task_id", taskId);

      // Insert new
      if (selectedIds.size > 0) {
        const rows = [...selectedIds].map(activity_id => ({
          activity_id,
          task_id: taskId,
        }));
        const { error } = await supabase.from("cpm_task_mappings").insert(rows);
        if (error) throw error;
      }

      toast.success(`${selectedIds.size}개 Activity 매핑 완료`);
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "매핑 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            CPM Activity 매핑 — {taskTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Activity 이름, WBS, ID 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {selectedIds.size}개 선택됨 · {filtered.length}개 표시
        </div>

        <ScrollArea type="always" className="flex-1 max-h-[400px] border rounded [&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll [&>[data-radix-scroll-area-viewport]]:!overflow-x-hidden [&_[data-radix-scroll-area-scrollbar]]:!opacity-100">
          <div className="divide-y divide-border pr-4">
            {filtered.map(a => (
              <label
                key={a.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{a.name}</span>
                    {a.is_critical && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">CP</Badge>
                    )}
                    {a.is_milestone && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">MS</Badge>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {a.wbs_full || "-"} · {a.mpp_task_id || "-"} · {a.duration}d · {a.progress ?? 0}%
                  </div>
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Activity가 없습니다. CPM 스케줄을 먼저 import하세요.
              </div>
            )}
          </div>
          <ScrollBar orientation="vertical" className="w-3" />
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "저장중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
