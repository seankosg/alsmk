import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const SESSION_KEY = "alsmk_unread_dialog_shown";

export function UnreadMessagesDialog() {
  const navigate = useNavigate();
  const { unreadCount, unreadMessages, loading } = useUnreadMessages();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (unreadCount > 0) {
      setOpen(true);
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  }, [loading, unreadCount]);

  const handleView = () => {
    setOpen(false);
    const latestConvId = unreadMessages[0]?.conversation_id;
    navigate(latestConvId ? `/messages?conv=${latestConvId}` : "/messages");
  };

  // Show top 5 previews
  const previews = unreadMessages.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            New Messages
          </DialogTitle>
          <DialogDescription>
            You have {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-48 overflow-auto">
          {previews.map((msg) => (
            <button
              key={msg.id}
              className="w-full flex items-start gap-2 text-sm rounded-md bg-muted/50 p-2 hover:bg-muted transition-colors cursor-pointer text-left"
              onClick={() => {
                setOpen(false);
                navigate(`/messages?conv=${msg.conversation_id}`);
              }}
            >
              <span className="font-medium text-foreground shrink-0">
                {msg.sender?.name}:
              </span>
              <span className="text-muted-foreground truncate">
                {msg.message.length > 60 ? msg.message.slice(0, 60) + "…" : msg.message}
              </span>
            </button>
          ))}
          {unreadCount > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{unreadCount - 5} more
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={handleView}>View Messages</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
