import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { Search, X } from "lucide-react";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const { memberId } = useAuthContext();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    if (selectedIds.length === 0) return;
    if (!memberId) {
      toast.error("사용자 정보를 불러오지 못했습니다. 페이지를 새로고침해주세요.");
      return;
    }
    setCreating(true);
    try {
      // For single recipient, check existing direct conversation
      if (selectedIds.length === 1) {
        const recipientId = selectedIds[0];
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

          if (sharedConvos) {
            for (const sc of sharedConvos) {
              const { data: conv } = await supabase
                .from("conversations")
                .select("id")
                .eq("id", sc.conversation_id)
                .eq("type", "direct")
                .maybeSingle();
              if (conv) {
                // Check it's actually a 2-person convo
                const { data: memberCount } = await supabase
                  .from("conversation_members")
                  .select("id")
                  .eq("conversation_id", conv.id);
                if (memberCount && memberCount.length === 2) {
                  onCreated(conv.id);
                  onOpenChange(false);
                  resetState();
                  return;
                }
              }
            }
          }
        }
      }

      // Create new conversation
      const type = selectedIds.length === 1 ? "direct" : "group";
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({ type })
        .select("id")
        .single();
      if (convErr) throw convErr;

      const memberInserts = [
        { conversation_id: newConv.id, member_id: memberId },
        ...selectedIds.map((id) => ({ conversation_id: newConv.id, member_id: id })),
      ];
      const { error: memErr } = await supabase.from("conversation_members").insert(memberInserts);
      if (memErr) throw memErr;

      onCreated(newConv.id);
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      console.error("Conversation creation failed:", err);
      toast.error(err.message || "대화 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setSelectedIds([]);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>새 대화</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Selected members */}
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

          {/* Search */}
          <div className="space-y-2">
            <Label>멤버 선택</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="이름 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Member list */}
          <ScrollArea className="h-[300px]">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>취소</Button>
          <Button onClick={handleCreate} disabled={creating || selectedIds.length === 0}>
            {creating ? "생성 중..." : selectedIds.length > 1 ? `그룹 대화 시작 (${selectedIds.length}명)` : "대화 시작"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
