import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { UserPlus, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";

interface ManageMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentMembers: { id: string; name: string }[];
}

export function ManageMembersDialog({
  open,
  onOpenChange,
  conversationId,
  currentMembers,
}: ManageMembersDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const currentMemberIds = new Set(currentMembers.map((m) => m.id));

  const { data: allMembers = [] } = useQuery({
    queryKey: ["all_members_for_convo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, team_id")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
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

  const nonMembers = allMembers.filter(
    (m) =>
      !currentMemberIds.has(m.id) &&
      m.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (memberId: string) => {
    setLoading(memberId);
    try {
      const { error } = await supabase.from("conversation_members").insert({
        conversation_id: conversationId,
        member_id: memberId,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["convo_members", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("멤버가 추가되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "멤버 추가에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setLoading(memberId);
    try {
      const { error } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("member_id", memberId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["convo_members", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("멤버가 제거되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "멤버 제거에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>대화 멤버 관리</DialogTitle>
        </DialogHeader>

        {/* Current Members */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            현재 멤버 ({currentMembers.length})
          </h4>
          <ScrollArea className="max-h-40">
            <div className="space-y-1">
              {currentMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-accent/50"
                >
                  <div>
                    <span className="text-sm font-medium">{m.name}</span>
                    {teamMap.get(allMembers.find((am) => am.id === m.id)?.team_id ?? "") && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {teamMap.get(allMembers.find((am) => am.id === m.id)?.team_id ?? "")}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(m.id)}
                    disabled={loading === m.id || currentMembers.length <= 2}
                    title={currentMembers.length <= 2 ? "최소 2명이 필요합니다" : "멤버 제거"}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Add Members */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            멤버 추가
          </h4>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {nonMembers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {search ? "검색 결과가 없습니다" : "추가할 멤버가 없습니다"}
                </p>
              )}
              {nonMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium">{m.name}</span>
                    {teamMap.get(m.team_id ?? "") && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {teamMap.get(m.team_id ?? "")}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => handleAdd(m.id)}
                    disabled={loading === m.id}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
