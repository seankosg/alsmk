import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const { memberId } = useAuthContext();
  const [recipientId, setRecipientId] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!recipientId || !memberId) return;
    setCreating(true);
    try {
      // Check existing direct conversation
      const { data: myConvos } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("member_id", memberId);

      const myConvoIds = (myConvos ?? []).map((c) => c.conversation_id);

      if (myConvoIds.length > 0) {
        const { data: sharedConvos } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("member_id", recipientId)
          .in("conversation_id", myConvoIds);

        if (sharedConvos) {
          for (const sc of sharedConvos) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", sc.conversation_id)
              .eq("type", "direct")
              .maybeSingle();
            if (conv) {
              onCreated(conv.id);
              onOpenChange(false);
              setRecipientId("");
              return;
            }
          }
        }
      }

      // Create new
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({ type: "direct" })
        .select("id")
        .single();
      if (convErr) throw convErr;

      const { error: memErr } = await supabase.from("conversation_members").insert([
        { conversation_id: newConv.id, member_id: memberId },
        { conversation_id: newConv.id, member_id: recipientId },
      ]);
      if (memErr) throw memErr;

      onCreated(newConv.id);
      onOpenChange(false);
      setRecipientId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create conversation.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member..." />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !recipientId}>
            {creating ? "Creating..." : "Start Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
