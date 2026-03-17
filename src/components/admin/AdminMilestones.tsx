import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Milestone = Tables<"milestones">;
type MilestoneStatus = Enums<"milestone_status">;

const statusColors: Record<string, string> = {
  completed: "bg-success/20 text-success border-success/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  upcoming: "bg-muted text-muted-foreground border-border",
  delayed: "bg-destructive/20 text-destructive border-destructive/30",
};

const statuses: MilestoneStatus[] = ["upcoming", "in_progress", "completed", "delayed"];

export function AdminMilestones() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState<MilestoneStatus>("upcoming");

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        target_date: targetDate,
        sort_order: parseInt(sortOrder) || 0,
        status,
      };
      if (editing) {
        const { error } = await supabase.from("milestones").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("milestones").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast.success(editing ? "Milestone updated" : "Milestone created");
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setName("");
    setTargetDate("");
    setSortOrder(String((milestones.length + 1)));
    setStatus("upcoming");
    setOpen(true);
  }

  function openEdit(ms: Milestone) {
    setEditing(ms);
    setName(ms.name);
    setTargetDate(ms.target_date);
    setSortOrder(String(ms.sort_order));
    setStatus(ms.status);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Milestones</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Milestone</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : milestones.map((ms) => (
              <TableRow key={ms.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{ms.sort_order}</TableCell>
                <TableCell className="font-medium">{ms.name}</TableCell>
                <TableCell className="font-mono text-xs">{ms.target_date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[ms.status]}>
                    {ms.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(ms)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(ms.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Milestone" : "New Milestone"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Milestone Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Foundation Work" />
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || !targetDate || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
