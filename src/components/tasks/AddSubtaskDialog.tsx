import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CategoryCombobox } from "./CategoryCombobox";

interface ParentTask {
  id: string;
  task_code: string | null;
  title: string;
  category: string | null;
  team_id: string;
  part_id: string | null;
  assignee_id: string | null;
  start_date: string;
  end_date: string;
  is_summary: boolean;
  action_plan: string | null;
  current_progress: number;
  actual_finish: string | null;
  issue_flag: "normal" | "warning" | "critical";
  issue_type: string | null;
  issue_description: string | null;
  milestone_id: string | null;
  created_by: string | null;
}

interface LookupItem { id: string; name: string; [key: string]: any; }

interface AddSubtaskDialogProps {
  parent: ParentTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams?: LookupItem[];
  members?: LookupItem[];
}

export function AddSubtaskDialog({ parent, open, onOpenChange, teams = [], members = [] }: AddSubtaskDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Pre-fill from parent
  const [title, setTitle] = useState(parent.title);
  const [category, setCategory] = useState(parent.category ?? "");
  const [teamId, setTeamId] = useState(parent.team_id);
  const [assigneeId, setAssigneeId] = useState<string | null>(parent.assignee_id);
  const [startDate, setStartDate] = useState(parent.start_date);
  const [endDate, setEndDate] = useState(parent.end_date);
  const [actionPlan, setActionPlan] = useState("");

  // Reset when parent changes
  const [lastParentId, setLastParentId] = useState(parent.id);
  if (parent.id !== lastParentId) {
    setLastParentId(parent.id);
    setTitle(parent.title);
    setCategory(parent.category ?? "");
    setTeamId(parent.team_id);
    setAssigneeId(parent.assignee_id);
    setStartDate(parent.start_date);
    setEndDate(parent.end_date);
    setActionPlan("");
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Subject is required.");
      return;
    }
    setSaving(true);
    try {
      // 1. If parent is not yet summary, convert it and clone original data as first subtask
      if (!parent.is_summary) {
        // Convert parent to summary
        const { error: updateErr } = await supabase.from("tasks").update({
          is_summary: true,
          action_plan: null,
          current_progress: 0,
          actual_finish: null,
          issue_flag: "normal" as const,
          issue_type: null,
          issue_description: null,
        }).eq("id", parent.id);
        if (updateErr) throw updateErr;

        // Clone original parent data as first subtask
        const { error: cloneErr } = await supabase.from("tasks").insert({
          parent_id: parent.id,
          title: parent.title,
          category: parent.category,
          team_id: parent.team_id,
          part_id: parent.part_id,
          assignee_id: parent.assignee_id,
          start_date: parent.start_date,
          end_date: parent.end_date,
          action_plan: parent.action_plan,
          current_progress: parent.current_progress,
          actual_finish: parent.actual_finish,
          issue_flag: parent.issue_flag,
          issue_type: parent.issue_type,
          issue_description: parent.issue_description,
          milestone_id: parent.milestone_id,
          created_by: parent.created_by,
          is_summary: false,
        });
        if (cloneErr) throw cloneErr;
      }

      // 2. Insert new subtask
      const { error: insertErr } = await supabase.from("tasks").insert({
        parent_id: parent.id,
        title: title.trim(),
        category: category.trim() || null,
        team_id: teamId,
        part_id: parent.part_id,
        assignee_id: assigneeId,
        start_date: startDate,
        end_date: endDate,
        action_plan: actionPlan.trim() || null,
        milestone_id: parent.milestone_id,
        created_by: parent.created_by,
        is_summary: false,
      });
      if (insertErr) throw insertErr;

      toast.success("Subtask added.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add subtask.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Add Subtask to <code className="text-sm text-muted-foreground">{parent.task_code}</code>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <div className="mt-1">
              <CategoryCombobox value={category} onChange={setCategory} placeholder="e.g. Design, Engineering" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Subtask subject" maxLength={200} className="mt-1 font-semibold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <Select value={assigneeId ?? "__unassigned__"} onValueChange={v => setAssigneeId(v === "__unassigned__" ? null : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="font-mono text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="font-mono text-xs mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Action Plan</Label>
            <Textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} rows={3} maxLength={2000} placeholder="Describe the action plan..." className="mt-1" />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add Subtask"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
