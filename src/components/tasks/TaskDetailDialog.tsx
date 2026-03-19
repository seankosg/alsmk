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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { calcPlannedProgress } from "@/lib/mockData";
import { useAuthContext } from "@/components/layout/AppLayout";

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
  readOnly?: boolean;
}

export function TaskDetailDialog({ task, open, onOpenChange, teams = [], members = [], milestones = [], readOnly = false }: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const auth = useAuthContext();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [currentProgress, setCurrentProgress] = useState(0);
  const [actualFinish, setActualFinish] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [issueFlag, setIssueFlag] = useState<"normal" | "warning" | "critical">("normal");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Notification recipients
  const [notifyRecipients, setNotifyRecipients] = useState<string[]>([]);
  const [showNotifySection, setShowNotifySection] = useState(false);

  // Track original flag to detect changes
  const [originalFlag, setOriginalFlag] = useState<"normal" | "warning" | "critical">("normal");

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setCurrentProgress(task.current_progress);
      setActualFinish(task.actual_finish ?? "");
      setActionPlan(task.action_plan ?? "");
      setIssueFlag(task.issue_flag);
      setOriginalFlag(task.issue_flag);
      setIssueType(task.issue_type ?? "");
      setIssueDescription(task.issue_description ?? "");
      setStartDate(task.start_date);
      setEndDate(task.end_date);
      setNotifyRecipients([]);
      setShowNotifySection(false);
    }
  }, [task]);

  // Show notify section when flag changes to warning/critical
  useEffect(() => {
    const flagRaised = issueFlag !== "normal" && originalFlag === "normal";
    const flagEscalated = issueFlag === "critical" && originalFlag === "warning";
    if (flagRaised || flagEscalated) {
      setShowNotifySection(true);
      // Pre-select assignee if it's not the current user
      if (task?.assignee_id && task.assignee_id !== auth.memberId) {
        setNotifyRecipients([task.assignee_id]);
      }
    } else if (issueFlag === "normal") {
      setShowNotifySection(false);
      setNotifyRecipients([]);
    }
  }, [issueFlag, originalFlag, task?.assignee_id, auth.memberId]);

  if (!task) return null;

  // Flag edit permission: only assignee, PM, or admin
  const canEditFlag = (auth.memberId === task.assignee_id) || auth.isAdminOrPm;

  const planned = calcPlannedProgress(startDate, endDate);
  const gap = currentProgress - planned;

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? "Unknown";
  const getMemberName = (id: string | null) => !id ? "Unassigned" : members.find(m => m.id === id)?.name ?? "Unknown";
  const getMemberTeamName = (member: LookupItem) => {
    const teamId = member.team_id;
    if (!teamId) return "";
    return teams.find(t => t.id === teamId)?.name ?? "";
  };

  const toggleRecipient = (memberId: string) => {
    setNotifyRecipients(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllRecipients = () => setNotifyRecipients(members.map(m => m.id));
  const deselectAllRecipients = () => setNotifyRecipients([]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("tasks").update({
        start_date: startDate,
        end_date: endDate,
        current_progress: currentProgress,
        actual_finish: actualFinish || null,
        action_plan: actionPlan.trim() || null,
        issue_flag: issueFlag,
        issue_type: issueFlag !== "normal" ? (issueType.trim() || null) : null,
        issue_description: issueFlag !== "normal" ? (issueDescription.trim() || null) : null,
      }).eq("id", task.id);

      if (error) throw error;

      // Send notifications if recipients selected
      if (showNotifySection && notifyRecipients.length > 0 && auth.memberId) {
        const notifTitle = `[${issueFlag.toUpperCase()}] ${task.task_code ?? "Task"}`;
        const notifMessage = `${auth.memberName ?? "Someone"} raised an issue: ${issueDescription.trim() || issueType.trim() || "No description"}`;

        const notifRows = notifyRecipients.map(recipientId => ({
          recipient_id: recipientId,
          sender_id: auth.memberId!,
          task_id: task.id,
          type: "flag_raised",
          title: notifTitle,
          message: notifMessage,
        }));

        const { error: notifError } = await supabase.from("notifications").insert(notifRows);
        if (notifError) {
          console.error("Failed to send notifications:", notifError);
          toast.warning("Task saved but notifications failed to send.");
        } else {
          toast.success(`Task updated. ${notifyRecipients.length} notification(s) sent.`);
        }
      } else {
        toast.success("Task updated.");
      }

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
              <Label htmlFor="edit-start-date" className="text-xs text-muted-foreground">Start</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={readOnly}
                className="font-mono text-xs mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-end-date" className="text-xs text-muted-foreground">Finish</Label>
              <Input
                id="edit-end-date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={readOnly}
                className="font-mono text-xs mt-1"
              />
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
              disabled={readOnly}
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
              disabled={readOnly}
            />
            <Progress value={currentProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Plan: {planned}%</span>
              <span className={`font-mono font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                Gap: {gap >= 0 ? '+' : ''}{gap}%
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
              disabled={readOnly}
            />
          </div>

          <Separator />

          {/* Editable: Issue Flag — permission-gated */}
          <div className="space-y-3">
            <Label>Issue Flag</Label>
            {!canEditFlag && !readOnly && (
              <p className="text-xs text-muted-foreground">Only the assignee, PM, or admin can change the flag.</p>
            )}
            <Select
              value={issueFlag}
              onValueChange={(v) => setIssueFlag(v as "normal" | "warning" | "critical")}
              disabled={readOnly || !canEditFlag}
            >
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
                    disabled={readOnly || !canEditFlag}
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
                    disabled={readOnly || !canEditFlag}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notify Members Section */}
          {showNotifySection && !readOnly && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Notify Members</Label>
                  <Badge variant="secondary" className="text-xs">{notifyRecipients.length} selected</Badge>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={selectAllRecipients}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={deselectAllRecipients}>
                    Deselect All
                  </Button>
                </div>
                <ScrollArea className="max-h-40 border border-border rounded-md">
                  <div className="p-2 space-y-1">
                    {members.map((m) => {
                      const teamName = getMemberTeamName(m);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={notifyRecipients.includes(m.id)}
                            onCheckedChange={() => toggleRecipient(m.id)}
                          />
                          <span className="flex-1">{m.name}</span>
                          {teamName && (
                            <span className="text-xs text-muted-foreground">{teamName}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-4">
          {!readOnly && (
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
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
