import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCard } from "./TaskCard";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  taskCode?: string | null;
  taskTitle?: string;
  taskIssueFlag?: "normal" | "warning" | "critical";
}

export function SendMessageDialog({
  open,
  onOpenChange,
  taskId,
  taskCode,
  taskTitle,
  taskIssueFlag,
}: SendMessageDialogProps) {
  const { memberId } = useAuthContext();
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, team_id");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const otherMembers = members.filter((m) => m.id !== memberId);

  const handleSend = async () => {
    if (!recipientId || !message.trim() || !memberId) return;
    setSending(true);
    try {
      // Check if a direct conversation already exists between these two members
      const { data: myConvos } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("member_id", memberId);

      const myConvoIds = (myConvos ?? []).map((c) => c.conversation_id);

      let conversationId: string | null = null;

      if (myConvoIds.length > 0) {
        // Find conversations where the recipient is also a member and type is direct
        const { data: sharedConvos } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("member_id", recipientId)
          .in("conversation_id", myConvoIds);

        if (sharedConvos && sharedConvos.length > 0) {
          // Verify it's a direct conversation
          for (const sc of sharedConvos) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("id, type")
              .eq("id", sc.conversation_id)
              .eq("type", "direct")
              .maybeSingle();
            if (conv) {
              conversationId = conv.id;
              break;
            }
          }
        }
      }

      // Create new conversation if none exists
      if (!conversationId) {
        const { data: newConv, error: convErr } = await supabase
          .from("conversations")
          .insert({ type: "direct" })
          .select("id")
          .single();
        if (convErr) throw convErr;
        conversationId = newConv.id;

        // Add both members
        const { error: memErr } = await supabase.from("conversation_members").insert([
          { conversation_id: conversationId, member_id: memberId },
          { conversation_id: conversationId, member_id: recipientId },
        ]);
        if (memErr) throw memErr;
      }

      // Send message
      const { error: msgErr } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        sender_id: memberId,
        message: message.trim(),
        referenced_task_id: taskId || null,
      });
      if (msgErr) throw msgErr;

      toast.success("Message sent!");
      setMessage("");
      setRecipientId("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {taskId && taskTitle && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Linked Task</Label>
              <TaskCard taskCode={taskCode ?? null} title={taskTitle} issueFlag={taskIssueFlag} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Recipient</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member..." />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Type your message..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !recipientId || !message.trim()}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
