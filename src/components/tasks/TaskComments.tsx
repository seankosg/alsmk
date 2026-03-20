import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TaskCommentsProps {
  taskId: string;
  taskAssigneeId?: string | null;
}

export function TaskComments({ taskId, taskAssigneeId }: TaskCommentsProps) {
  const { memberId, memberName, isAdminOrPm } = useAuthContext();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [commentType, setCommentType] = useState<"comment" | "instruction" | "reply">("comment");
  const [sending, setSending] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["task_comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  // Get member names for comments
  const authorIds = [...new Set(comments.map((c) => c.author_id))];
  const { data: authors = [] } = useQuery({
    queryKey: ["comment_authors", authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, name")
        .in("id", authorIds);
      if (error) throw error;
      return data;
    },
    enabled: authorIds.length > 0,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${taskId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "task_comments",
        filter: `task_id=eq.${taskId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["task_comments", taskId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId, queryClient]);

  const getAuthorName = (id: string) => authors.find((a) => a.id === id)?.name ?? "Unknown";

  const typeBadgeStyle = (type: string) => {
    switch (type) {
      case "instruction": return "bg-info/20 text-info border-info/40";
      case "reply": return "bg-muted text-muted-foreground border-border";
      default: return "bg-accent text-accent-foreground border-border";
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !memberId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: memberId,
        type: commentType,
        message: message.trim(),
      });
      if (error) throw error;

      // Send notification for all comment types
      if (taskAssigneeId && taskAssigneeId !== memberId) {
        const titleMap: Record<string, string> = {
          comment: `New comment from ${memberName ?? "User"}`,
          instruction: `New instruction from ${memberName ?? "PM"}`,
          reply: `New reply from ${memberName ?? "User"}`,
        };
        await supabase.from("notifications").insert({
          recipient_id: taskAssigneeId,
          sender_id: memberId,
          task_id: taskId,
          type: commentType,
          title: titleMap[commentType] ?? `New ${commentType} from ${memberName ?? "User"}`,
          message: message.trim().substring(0, 200),
        });
      }

      setMessage("");
      toast.success("Comment posted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-mono text-sm font-semibold">Comments</h4>

      <ScrollArea className="max-h-48 border border-border rounded-md">
        <div className="p-2 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>}
          {!isLoading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className={`rounded-md border p-2 ${typeBadgeStyle(c.type)}`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {c.type}
                </Badge>
                <span className="text-xs font-medium">{getAuthorName(c.author_id)}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {format(new Date(c.created_at), "MM/dd HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.message}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 items-end">
        {isAdminOrPm && (
          <Select value={commentType} onValueChange={(v) => setCommentType(v as any)}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="instruction">Instruction</SelectItem>
              <SelectItem value="reply">Reply</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Write a comment..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()} className="shrink-0 h-8 w-8">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
