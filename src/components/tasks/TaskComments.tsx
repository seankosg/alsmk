import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthContext } from "@/components/layout/AppLayout";
import { Send, Reply, X, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TaskCommentsProps {
  taskId: string;
  taskAssigneeId?: string | null;
}

export function TaskComments({ taskId, taskAssigneeId }: TaskCommentsProps) {
  const { memberId, memberName, isAdmin, isAdminOrPm } = useAuthContext();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [commentType, setCommentType] = useState<"comment" | "instruction">("comment");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; authorId: string; authorName: string; message: string; type: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");

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

  // Realtime — listen for INSERT, UPDATE, DELETE
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${taskId}`)
      .on("postgres_changes", {
        event: "*",
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

  const canEditOrDelete = (authorId: string) => authorId === memberId || isAdmin;

  const typeBadgeStyle = (type: string) => {
    switch (type) {
      case "instruction": return "bg-info/20 text-info border-info/40";
      case "reply": return "bg-muted text-muted-foreground border-border";
      default: return "bg-accent text-accent-foreground border-border";
    }
  };

  const handleReply = (comment: typeof comments[0]) => {
    setReplyTo({
      id: comment.id,
      authorId: comment.author_id,
      authorName: getAuthorName(comment.author_id),
      message: comment.message,
      type: comment.type,
    });
  };

  const handleEdit = (comment: typeof comments[0]) => {
    setEditingId(comment.id);
    setEditingMessage(comment.message);
  };

  const handleEditSave = async () => {
    if (!editingId || !editingMessage.trim()) return;
    try {
      const { error } = await supabase
        .from("task_comments")
        .update({ message: editingMessage.trim() })
        .eq("id", editingId);
      if (error) throw error;
      setEditingId(null);
      setEditingMessage("");
      queryClient.invalidateQueries({ queryKey: ["task_comments", taskId] });
      toast.success("Comment updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update comment.");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment? Replies will also be removed.")) return;
    try {
      const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["task_comments", taskId] });
      toast.success("Comment deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete comment.");
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !memberId) return;
    setSending(true);
    try {
      const isReply = !!replyTo;
      const finalType = isReply ? "reply" : commentType;

      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: memberId,
        type: finalType,
        message: message.trim(),
        parent_comment_id: replyTo?.id ?? null,
      });
      if (error) throw error;

      // Send notification
      if (isReply && replyTo) {
        if (replyTo.authorId !== memberId) {
          await supabase.from("notifications").insert({
            recipient_id: replyTo.authorId,
            sender_id: memberId,
            task_id: taskId,
            type: "reply",
            title: `New reply from ${memberName ?? "User"}`,
            message: message.trim().substring(0, 200),
          });
        }
      } else {
        if (taskAssigneeId && taskAssigneeId !== memberId) {
          const titleMap: Record<string, string> = {
            comment: `New comment from ${memberName ?? "User"}`,
            instruction: `New instruction from ${memberName ?? "PM"}`,
          };
          await supabase.from("notifications").insert({
            recipient_id: taskAssigneeId,
            sender_id: memberId,
            task_id: taskId,
            type: finalType,
            title: titleMap[finalType] ?? `New ${finalType} from ${memberName ?? "User"}`,
            message: message.trim().substring(0, 200),
          });
        }
      }

      setMessage("");
      setReplyTo(null);
      toast.success("Comment posted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment.");
    } finally {
      setSending(false);
    }
  };

  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const repliesByParent = comments.reduce<Record<string, typeof comments>>((acc, c) => {
    if (c.parent_comment_id) {
      if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
      acc[c.parent_comment_id].push(c);
    }
    return acc;
  }, {});

  const renderComment = (c: typeof comments[0], isReplyItem = false) => {
    const isEditing = editingId === c.id;
    const showActions = canEditOrDelete(c.author_id);

    return (
      <div key={c.id} className={`rounded-md border p-2 ${typeBadgeStyle(isReplyItem ? "reply" : c.type)} ${isReplyItem ? "ml-5" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {isReplyItem ? "reply" : c.type}
          </Badge>
          <span className="text-xs font-medium">{getAuthorName(c.author_id)}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(c.created_at), "MM/dd HH:mm")}
          </span>
          {showActions && !isEditing && (
            <div className="flex items-center gap-0.5">
              <button onClick={() => handleEdit(c)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => handleDelete(c.id)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-1.5">
            <Textarea
              value={editingMessage}
              onChange={(e) => setEditingMessage(e.target.value)}
              rows={2}
              className="resize-none text-sm min-h-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                if (e.key === "Escape") { setEditingId(null); setEditingMessage(""); }
              }}
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setEditingId(null); setEditingMessage(""); }}>
                Cancel
              </Button>
              <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleEditSave} disabled={!editingMessage.trim()}>
                <Check className="h-3 w-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{c.message}</p>
            {!isReplyItem && (
              <button
                onClick={() => handleReply(c)}
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <h4 className="font-mono text-sm font-semibold">Comments</h4>

      <ScrollArea className="max-h-64 border border-border rounded-md">
        <div className="p-2 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>}
          {!isLoading && topLevelComments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
          )}
          {topLevelComments.map((c) => (
            <div key={c.id} className="space-y-1">
              {renderComment(c)}
              {repliesByParent[c.id]?.map((r) => renderComment(r, true))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 border border-border">
          <Reply className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground truncate">
            Replying to <span className="font-medium text-foreground">{replyTo.authorName}</span>: {replyTo.message.substring(0, 60)}{replyTo.message.length > 60 ? "..." : ""}
          </span>
          <button onClick={() => setReplyTo(null)} className="ml-auto shrink-0 hover:text-foreground text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {isAdminOrPm && !replyTo && (
          <Select value={commentType} onValueChange={(v) => setCommentType(v as any)}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="instruction">Instruction</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder={replyTo ? `Reply to ${replyTo.authorName}...` : "Write a comment..."}
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
