import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewMessage: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewMessage }: ConversationListProps) {
  const { memberId } = useAuthContext();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", memberId],
    queryFn: async () => {
      if (!memberId) return [];

      // Get my conversation IDs
      const { data: myMemberships, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("member_id", memberId);
      if (memErr) throw memErr;
      if (!myMemberships || myMemberships.length === 0) return [];

      const convoIds = myMemberships.map((m) => m.conversation_id);

      // Get conversation details
      const { data: convos, error: convErr } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convoIds)
        .order("created_at", { ascending: false });
      if (convErr) throw convErr;

      // Get all members for these conversations
      const { data: allMembers } = await supabase
        .from("conversation_members")
        .select("conversation_id, member_id")
        .in("conversation_id", convoIds);

      // Get member names
      const memberIds = [...new Set((allMembers ?? []).map((m) => m.member_id))];
      const { data: memberNames } = await supabase
        .from("members")
        .select("id, name")
        .in("id", memberIds);

      const nameMap = new Map((memberNames ?? []).map((m) => [m.id, m.name]));

      // Get unread counts
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
              "w-full text-left px-3 py-3 border-b border-border hover:bg-accent/50 transition-colors",
              selectedId === c.id && "bg-accent"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{c.displayName}</span>
              {c.unreadCount > 0 && (
                <Badge className="ml-2 h-5 min-w-5 flex items-center justify-center text-[10px] bg-primary">
                  {c.unreadCount}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}
