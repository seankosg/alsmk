import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskCard } from "./TaskCard";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { Search, X } from "lucide-react";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, team_id");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const otherMembers = members.filter((m) => m.id !== memberId);
  const filteredMembers = otherMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeMember = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";

  const resetState = () => {
    setSelectedIds([]);
    setMessage("");
    setSearch("");
  };

  const handleSend = async () => {
    if (selectedIds.length === 0 || !message.trim() || !memberId) return;
    setSending(true);
    try {
      // For each recipient, find or create a conversation and send
      for (const recipientId of selectedIds) {
        let conversationId: string | null = null;

        // Check existing direct conversation (only for 1:1)
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

          if (sharedConvos && sharedConvos.length > 0) {
            for (const sc of sharedConvos) {
              const { data: conv } = await supabase
                .from("conversations")
                .select("id, type")
                .eq("id", sc.conversation_id)
                .eq("type", "direct")
                .maybeSingle();
              if (conv) {
                // Verify it's a 2-person convo
                const { data: memberCount } = await supabase
                  .from("conversation_members")
                  .select("id")
                  .eq("conversation_id", conv.id);
                if (memberCount && memberCount.length === 2) {
                  conversationId = conv.id;
                  break;
                }
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
      }

      toast.success(selectedIds.length > 1 ? `${selectedIds.length}명에게 메시지를 보냈습니다.` : "메시지를 보냈습니다.");
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>메시지 보내기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {taskId && taskTitle && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">연결된 업무</Label>
              <TaskCard taskCode={taskCode ?? null} title={taskTitle} issueFlag={taskIssueFlag} />
            </div>
          )}

          {/* Selected recipients */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {getMemberName(id)}
                  <button
                    onClick={() => removeMember(id)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>수신자</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="이름 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <ScrollArea className="max-h-40">
              <div className="space-y-0.5">
                {filteredMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.includes(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{m.name}</span>
                      {teamMap.get(m.team_id ?? "") && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {teamMap.get(m.team_id ?? "")}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {search ? "검색 결과가 없습니다" : "멤버가 없습니다"}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>메시지</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="메시지를 입력하세요..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
            취소
          </Button>
          <Button onClick={handleSend} disabled={sending || selectedIds.length === 0 || !message.trim()}>
            {sending ? "전송 중..." : selectedIds.length > 1 ? `${selectedIds.length}명에게 전송` : "전송"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
