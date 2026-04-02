import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatArea } from "@/components/messages/ChatArea";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { MessageSquare } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";

export default function Messages() {
  const { readOnly } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    searchParams.get("conv") || null
  );
  useEffect(() => {
    const conv = searchParams.get("conv");
    if (conv && conv !== selectedConversation) {
      setSelectedConversation(conv);
    }
  }, [searchParams]);
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [taskDialogId, setTaskDialogId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get members for selected conversation
  const { data: convoMembers = [] } = useQuery({
    queryKey: ["convo_members", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data: cm, error } = await supabase
        .from("conversation_members")
        .select("member_id")
        .eq("conversation_id", selectedConversation);
      if (error) throw error;
      const memberIds = (cm ?? []).map((c) => c.member_id);
      if (memberIds.length === 0) return [];
      const { data: members } = await supabase
        .from("members")
        .select("id, name")
        .in("id", memberIds);
      return members ?? [];
    },
    enabled: !!selectedConversation,
  });

  // For TaskDetailDialog
  const { data: selectedTask } = useQuery({
    queryKey: ["task_detail", taskDialogId],
    queryFn: async () => {
      if (!taskDialogId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskDialogId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskDialogId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, team_id, is_pm");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const handleCreated = (conversationId: string) => {
    setSelectedConversation(conversationId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.12)-theme(spacing.12))] flex rounded-lg border border-border bg-card overflow-hidden">
      <div className="w-72 shrink-0">
        <ConversationList
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
          onNewMessage={() => setNewConvoOpen(true)}
          onDelete={(id) => {
            if (selectedConversation === id) setSelectedConversation(null);
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedConversation ? (
          <ChatArea
            conversationId={selectedConversation}
            members={convoMembers}
            onTaskClick={(taskId) => setTaskDialogId(taskId)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newConvoOpen}
        onOpenChange={setNewConvoOpen}
        onCreated={handleCreated}
      />

      <TaskDetailDialog
        task={selectedTask}
        open={!!taskDialogId}
        onOpenChange={(o) => !o && setTaskDialogId(null)}
        teams={teams}
        members={members}
        milestones={milestones}
        readOnly
      />
    </div>
  );
}
