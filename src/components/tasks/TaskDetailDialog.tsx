import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { calcPlannedProgress } from "@/lib/mockData";

interface Task {
  id: string;
  task_code: string | null;
  title: string;
  category: string | null;
  action_plan: string | null;
  milestone_id: string | null;
  team_id: string;
  part_id: string | null;
  assignee_id: string | null;
  start_date: string;
  end_date: string;
  actual_finish: string | null;
  current_progress: number;
  issue_flag: "normal" | "warning" | "critical";
  issue_type: string | null;
  issue_description: string | null;
}

interface LookupItem { id: string; name: string; [key: string]: any; }

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams?: LookupItem[];
  members?: LookupItem[];
  milestones?: LookupItem[];
}

export function TaskDetailDialog({ task, open, onOpenChange, teams = [], members = [], milestones = [] }: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [currentProgress, setCurrentProgress] = useState(0);
  const [actualFinish, setActualFinish] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [issueFlag, setIssueFlag] = useState<"normal" | "warning" | "critical">("normal");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setCurrentProgress(task.current_progress);
      setActualFinish(task.actual_finish ?? "");
      setActionPlan(task.action_plan ?? "");
      setIssueFlag(task.issue_flag);
      setIssueType(task.issue_type ?? "");
      setIssueDescription(task.issue_description ?? "");
    }
  }, [task]);

  if (!task) return null;

  const planned = calcPlannedProgress(task.start_date, task.end_date);
  const gap = currentProgress - planned;

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? "Unknown";
  const getMemberName = (id: string | null) => !id ? "Unassigned" : members.find(m => m.id === id)?.name ?? "Unknown";

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("tasks").update({
        current_progress: currentProgress,
        actual_finish: actualFinish || null,
        action_plan: actionPlan.trim() || null,
        issue_flag: issueFlag,
        issue_type: issueFlag !== "normal" ? (issueType.trim() || null) : null,
        issue_description: issueFlag !== "normal" ? (issueDescription.trim() || null) : null,
      }).eq("id", task.id);

      if (error) throw error;
      toast.success("Task updated.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
      toast.success("Task deleted.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <code className="text-sm text-muted-foreground">{task.task_code}</code>
            {issueFlag !== "normal" && (
              <Badge variant={issueFlag === "critical" ? "destructive" : "outline"} className={issueFlag === "warning" ? "border-warning text-warning" : ""}>
                {issueFlag}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only info */}
          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="text-sm font-medium">{task.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Subject</p>
            <h3 className="text-lg font-semibold">{task.title}</h3>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Team</p>
              <p className="font-medium">{getTeamName(task.team_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assignee</p>
              <p className="font-medium">{getMemberName(task.assignee_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-mono text-xs">{task.start_date}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Finish</p>
              <p className="font-mono text-xs">{task.end_date}</p>
            </div>
          </div>

          <Separator />

          {/* Editable: Action Plan */}
          <div className="space-y-2">
            <Label htmlFor="edit-action-plan">Action Plan</Label>
            <Textarea
              id="edit-action-plan"
              value={actionPlan}
              onChange={e => setActionPlan(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Describe the action plan..."
            />
          </div>

          <Separator />

          {/* Editable: Actual % */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Actual %</Label>
              <span className="font-mono text-sm font-bold">{currentProgress}%</span>
            </div>
            <Slider
              value={[currentProgress]}
              onValueChange={([v]) => setCurrentProgress(v)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <Progress value={currentProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Plan: {planned}%</span>
              <span className={`font-mono font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                차이: {gap >= 0 ? '+' : ''}{gap}%
              </span>
            </div>
          </div>

          {/* Editable: Actual Finish */}
          <div className="space-y-2">
            <Label htmlFor="edit-actual-finish">Actual Finish</Label>
            <Input
              id="edit-actual-finish"
              type="date"
              value={actualFinish}
              onChange={e => setActualFinish(e.target.value)}
            />
          </div>

          <Separator />

          {/* Editable: Issue Flag */}
          <div className="space-y-3">
            <Label>Issue Flag</Label>
            <Select value={issueFlag} onValueChange={(v) => setIssueFlag(v as "normal" | "warning" | "critical")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            {issueFlag !== "normal" && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-issue-type" className="text-xs">Issue Type</Label>
                  <Input
                    id="edit-issue-type"
                    value={issueType}
                    onChange={e => setIssueType(e.target.value)}
                    placeholder="e.g. Delay, Resource, Quality"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-issue-desc" className="text-xs">Issue Description</Label>
                  <Textarea
                    id="edit-issue-desc"
                    value={issueDescription}
                    onChange={e => setIssueDescription(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Describe the issue..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete task <strong>{task.task_code}</strong>. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
