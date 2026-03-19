import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";

interface UnreadMessage {
  id: string;
  message: string;
  created_at: string;
  conversation_id: string;
  sender: { id: string; name: string } | null;
}

export function useUnreadMessages() {
  const { memberId } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnread = useCallback(async () => {
    if (!memberId) return;

    // Get conversations where I'm a member
    const { data: myConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("member_id", memberId);

    if (!myConvs || myConvs.length === 0) {
      setUnreadCount(0);
      setUnreadMessages([]);
      setLoading(false);
      return;
    }

    const convIds = myConvs.map((c) => c.conversation_id);

    const { data, error } = await supabase
      .from("direct_messages")
      .select("id, message, created_at, conversation_id, sender_id")
      .in("conversation_id", convIds)
      .neq("sender_id", memberId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Failed to fetch unread messages:", error);
      setLoading(false);
      return;
    }

    // Resolve sender names
    const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
    const { data: senders } = senderIds.length
      ? await supabase.from("members").select("id, name").in("id", senderIds)
      : { data: [] };

    const senderMap = new Map((senders || []).map((s) => [s.id, s.name]));

    const mapped: UnreadMessage[] = (data || []).map((m) => ({
      id: m.id,
      message: m.message,
      created_at: m.created_at,
      conversation_id: m.conversation_id,
      sender: { id: m.sender_id, name: senderMap.get(m.sender_id) || "Unknown" },
    }));

    setUnreadMessages(mapped);
    setUnreadCount(mapped.length);
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Realtime: listen for new inserts to direct_messages
  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel("unread-dm-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as any;
          // Only count messages not sent by me
          if (msg.sender_id !== memberId) {
            fetchUnread();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        () => {
          // Re-fetch when messages are marked as read
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, fetchUnread]);

  return { unreadCount, unreadMessages, loading, refetch: fetchUnread };
}
