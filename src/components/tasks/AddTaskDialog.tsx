import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/components/layout/AppLayout";

export function AddTaskDialog() {
  const { memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const resetForm = () => {
    setCategory("");
    setSubject("");
    setActionPlan("");
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !startDate || !endDate) {
      toast.error("Subject, Start, and Finish are required.");
      return;
    }
    if (endDate < startDate) {
      toast.error("Finish date must be after Start date.");
      return;
    }

    setSaving(true);
    try {
      // We still need team_id (required by DB). For now use a default or derive from member.
      // Since team_id is required, we fetch the member's team
      const { data: member } = await supabase
        .from("members")
        .select("team_id, part_id")
        .eq("id", memberId)
        .single();

      const teamId = member?.team_id;
      if (!teamId) {
        toast.error("Your member profile has no team assigned.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        title: subject.trim(),
        category: category || null,
        action_plan: actionPlan.trim() || null,
        team_id: teamId,
        part_id: member?.part_id || null,
        assignee_id: memberId,
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;

      toast.success("Task created successfully.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>Task Code will be auto-generated. Plan % is calculated automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {/* Category options will be added later */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Task subject" maxLength={200} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action-plan">Action Plan</Label>
            <Textarea id="action-plan" value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="Describe the action plan..." rows={3} maxLength={2000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start</Label>
              <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Finish</Label>
              <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Task"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
