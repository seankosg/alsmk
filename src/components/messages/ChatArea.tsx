import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TaskCard } from "./TaskCard";
import { TaskSearchPopover } from "./TaskSearchPopover";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Send, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatAreaProps {
  conversationId: string;
  members: { id: string; name: string }[];
  onTaskClick?: (taskId: string) => void;
}

export function ChatArea({ conversationId, members, onTaskClick }: ChatAreaProps) {
  const { memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [referencedTaskId, setReferencedTaskId] = useState<string | null>(null);
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["direct_messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  // Fetch referenced tasks
  const taskIds = [...new Set(messages.filter((m) => m.referenced_task_id).map((m) => m.referenced_task_id!))];
  const { data: referencedTasks = [] } = useQuery({
    queryKey: ["referenced_tasks", taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, task_code, title, issue_flag")
        .in("id", taskIds);
      if (error) throw error;
      return data;
    },
    enabled: taskIds.length > 0,
  });

  // Selected task for attachment
  const { data: selectedTask } = useQuery({
    queryKey: ["task_for_attach", referencedTaskId],
    queryFn: async () => {
      if (!referencedTaskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select("id, task_code, title, issue_flag")
        .eq("id", referencedTaskId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!referencedTaskId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["direct_messages", conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Mark messages as read
  useEffect(() => {
    if (!memberId || messages.length === 0) return;
    const unread = messages.filter((m) => !m.is_read && m.sender_id !== memberId);
    if (unread.length > 0) {
      supabase
        .from("direct_messages")
        .update({ is_read: true })
        .in("id", unread.map((m) => m.id))
        .then();
    }
  }, [messages, memberId]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";
  const getTask = (id: string) => referencedTasks.find((t) => t.id === id);

  const handleSend = async () => {
    if (!message.trim() || !memberId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        sender_id: memberId,
        message: message.trim(),
        referenced_task_id: referencedTaskId,
      });
      if (error) throw error;
      setMessage("");
      setReferencedTaskId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground text-center">Loading...</p>}
          {messages.map((msg) => {
            const isMe = msg.sender_id === memberId;
            const refTask = msg.referenced_task_id ? getTask(msg.referenced_task_id) : null;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  {getMemberName(msg.sender_id)} · {format(new Date(msg.created_at), "MM/dd HH:mm")}
                </p>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isMe ? "bg-primary text-primary-foreground" : "bg-accent"
                  }`}
                >
                  {refTask && (
                    <div className="mb-2">
                      <TaskCard
                        taskCode={refTask.task_code}
                        title={refTask.title}
                        issueFlag={refTask.issue_flag as any}
                        onClick={() => onTaskClick?.(refTask.id)}
                      />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 space-y-2">
        {selectedTask && (
          <div className="flex items-center gap-2">
            <TaskCard taskCode={selectedTask.task_code} title={selectedTask.title} issueFlag={selectedTask.issue_flag as any} />
            <Button variant="ghost" size="sm" onClick={() => setReferencedTaskId(null)} className="text-xs">✕</Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <TaskSearchPopover
            open={taskSearchOpen}
            onOpenChange={setTaskSearchOpen}
            onSelectTask={(taskId) => {
              setReferencedTaskId(taskId);
              setTaskSearchOpen(false);
            }}
          >
            <Button variant="ghost" size="icon" className="shrink-0">
              <Paperclip className="h-4 w-4" />
            </Button>
          </TaskSearchPopover>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
