import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/components/layout/AppLayout";

export function AddTaskDialog() {
  const { memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [partId, setPartId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Filter parts by selected team
  const filteredParts = teamId ? parts.filter(p => p.team_id === teamId) : [];

  const resetForm = () => {
    setTitle("");
    setTeamId("");
    setPartId("");
    setMilestoneId("");
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !teamId || !startDate || !endDate) {
      toast.error("Title, Team, Start Date, End Date are required.");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be after start date.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        team_id: teamId,
        part_id: partId || null,
        milestone_id: milestoneId || null,
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>Create a task assigned to you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" maxLength={200} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={(v) => { setTeamId(v); setPartId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Part</Label>
              <Select value={partId} onValueChange={setPartId} disabled={!teamId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredParts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Milestone</Label>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
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
