import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewMessage: () => void;
  onDelete?: (id: string) => void;
}

export function ConversationList({ selectedId, onSelect, onNewMessage, onDelete }: ConversationListProps) {
  const { memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data: myMemberships, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("member_id", memberId);
      if (memErr) throw memErr;
      if (!myMemberships || myMemberships.length === 0) return [];

      const convoIds = myMemberships.map((m) => m.conversation_id);

      const { data: convos, error: convErr } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convoIds)
        .order("created_at", { ascending: false });
      if (convErr) throw convErr;

      const { data: allMembers } = await supabase
        .from("conversation_members")
        .select("conversation_id, member_id")
        .in("conversation_id", convoIds);

      const memberIds = [...new Set((allMembers ?? []).map((m) => m.member_id))];
      const { data: memberNames } = await supabase
        .from("members")
        .select("id, name")
        .in("id", memberIds);

      const nameMap = new Map((memberNames ?? []).map((m) => [m.id, m.name]));

      const { data: unreadMsgs } = await supabase
        .from("direct_messages")
        .select("conversation_id")
        .in("conversation_id", convoIds)
        .eq("is_read", false)
        .neq("sender_id", memberId);

      const unreadMap = new Map<string, number>();
      (unreadMsgs ?? []).forEach((m) => {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
      });

      return (convos ?? []).map((c) => {
        const otherMemberIds = (allMembers ?? [])
          .filter((m) => m.conversation_id === c.id && m.member_id !== memberId)
          .map((m) => m.member_id);
        const otherNames = otherMemberIds.map((id) => nameMap.get(id) ?? "Unknown");
        return {
          ...c,
          displayName: c.title || otherNames.join(", ") || "Unknown",
          unreadCount: unreadMap.get(c.id) ?? 0,
        };
      });
    },
    enabled: !!memberId,
    refetchInterval: 10_000,
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete messages first, then members, then conversation
      await supabase.from("direct_messages").delete().eq("conversation_id", deleteTarget);
      await supabase.from("conversation_members").delete().eq("conversation_id", deleteTarget);
      const { error } = await supabase.from("conversations").delete().eq("id", deleteTarget);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onDelete?.(deleteTarget);
      toast.success("대화가 삭제되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-mono text-sm font-semibold">Messages</h3>
        <Button variant="ghost" size="icon" onClick={onNewMessage} className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>}
        {!isLoading && conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "group w-full text-left px-3 py-3 border-b border-border hover:bg-accent/50 transition-colors",
              selectedId === c.id && "bg-accent"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{c.displayName}</span>
              <div className="flex items-center gap-1">
                {c.unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 flex items-center justify-center text-[10px] bg-primary">
                    {c.unreadCount}
                  </Badge>
                )}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </ScrollArea>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 대화와 모든 메시지가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
