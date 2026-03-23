import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link2, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activityId: string;
  activityName: string;
  onMapped: () => void;
}

export function MapTasksDialog({ activityId, activityName, onMapped }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Get existing mappings
  const { data: existingMappings = [] } = useQuery({
    queryKey: ["cpm_existing_mappings", activityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_task_mappings")
        .select("task_id")
        .eq("activity_id", activityId);
      return (data || []).map(d => d.task_id);
    },
    enabled: open,
  });

  // Get all tasks with team/member info
  const { data: allTasks = [] } = useQuery({
    queryKey: ["all_tasks_for_mapping"],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, task_code, team_id, assignee_id, current_progress, start_date, end_date, is_summary")
        .is("deleted_at", null)
        .eq("is_summary", false)
        .order("title");
      if (!tasks) return [];

      const teamIds = [...new Set(tasks.map(t => t.team_id))];
      const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
      const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t.name]));

      const assigneeIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))] as string[];
      const { data: members } = assigneeIds.length
        ? await supabase.from("members").select("id, name").in("id", assigneeIds)
        : { data: [] };
      const memberMap = Object.fromEntries((members || []).map(m => [m.id, m.name]));

      return tasks.map(t => ({
        ...t,
        team_name: teamMap[t.team_id] || "",
        assignee_name: t.assignee_id ? (memberMap[t.assignee_id] || "") : "",
      }));
    },
    enabled: open,
  });

  // Initialize selected with existing mappings
  useState(() => {
    if (existingMappings.length && selectedIds.size === 0) {
      setSelectedIds(new Set(existingMappings));
    }
  });

  const filtered = allTasks.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.task_code || "").toLowerCase().includes(q) ||
      t.team_name.toLowerCase().includes(q) ||
      t.assignee_name.toLowerCase().includes(q)
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
      // Remove old mappings
      await supabase.from("cpm_task_mappings").delete().eq("activity_id", activityId);

      // Insert new
      if (selectedIds.size > 0) {
        const rows = [...selectedIds].map(task_id => ({
          activity_id: activityId,
          task_id,
        }));
        const { error } = await supabase.from("cpm_task_mappings").insert(rows);
        if (error) throw error;
      }

      toast.success(`${selectedIds.size}개 Task 매핑 완료`);
      onMapped();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "매핑 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSelectedIds(new Set(existingMappings));
      setSearch("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Link2 className="h-3.5 w-3.5" /> Task 매핑
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Task 매핑 — {activityName}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="제목, 코드, 팀, 담당자 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {selectedIds.size}개 선택됨 · {filtered.length}개 표시
        </div>

        <ScrollArea className="flex-1 max-h-[400px] border rounded [&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll">
          <div className="divide-y divide-border pr-3">
            {filtered.map(t => (
              <label
                key={t.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{t.title}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {t.task_code || "-"} · {t.team_name} · {t.assignee_name || "미배정"} · {t.current_progress}%
                  </div>
                </div>
              </label>
            ))}
          </div>
          <ScrollBar orientation="vertical" className="w-3" />
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "저장중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
