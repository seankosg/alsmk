import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BellRing, X } from "lucide-react";

interface Master {
  id: string;
  rfi_no: string;
  title_clean: string | null;
  due_date: string | null;
  originator: string | null;
  discipline: string | null;
  status: string;
}

interface Member { id: string; name: string; }

export function RfiReminderDialog({ master, onOpenChange }: { master: Master | null; onOpenChange: (o: boolean) => void }) {
  const { memberId } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["members-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (master) {
      setMessage(
        `[RFI ${master.rfi_no}] 답변 기한 알림\n` +
        `제목: ${master.title_clean ?? "-"}\n` +
        `기한: ${master.due_date ?? "-"}\n` +
        `상태: ${master.status}\n\n` +
        `확인 부탁드립니다.`
      );
      setSelected([]);
    }
  }, [master]);

  const filteredMembers = useMemo(() => members, [members]);

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const send = async () => {
    if (!master || !memberId || selected.length === 0 || !message.trim()) return;
    setSending(true);
    try {
      for (const recipientId of selected) {
        // find or create direct conversation
        let convId: string | null = null;
        const { data: myConvos } = await supabase.from("conversation_members").select("conversation_id").eq("member_id", memberId);
        const myIds = (myConvos ?? []).map((c: any) => c.conversation_id);
        if (myIds.length) {
          const { data: shared } = await supabase.from("conversation_members").select("conversation_id").eq("member_id", recipientId).in("conversation_id", myIds);
          for (const sc of shared ?? []) {
            const { data: conv } = await supabase.from("conversations").select("id, type").eq("id", (sc as any).conversation_id).eq("type", "direct").maybeSingle();
            if (conv) {
              const { data: mc } = await supabase.from("conversation_members").select("id").eq("conversation_id", (conv as any).id);
              if (mc && mc.length === 2) { convId = (conv as any).id; break; }
            }
          }
        }
        if (!convId) {
          const { data: newConv, error: cErr } = await supabase.from("conversations").insert({ type: "direct" }).select("id").single();
          if (cErr) throw cErr;
          convId = (newConv as any).id;
          const { error: mErr } = await supabase.from("conversation_members").insert([
            { conversation_id: convId, member_id: memberId },
            { conversation_id: convId, member_id: recipientId },
          ]);
          if (mErr) throw mErr;
        }
        const { data: dm, error: dmErr } = await supabase.from("direct_messages").insert({
          conversation_id: convId,
          sender_id: memberId,
          message: message.trim(),
        }).select("id").single();
        if (dmErr) throw dmErr;
        await (supabase as any).from("rfi_reminders").insert({
          rfi_no: master.rfi_no,
          sent_by: memberId,
          sent_to: recipientId,
          channel: "direct_message",
          direct_message_id: (dm as any).id,
          message,
        });
      }
      toast.success(`${selected.length}명에게 리마인더를 전송했습니다.`);
      qc.invalidateQueries({ queryKey: ["rfi_masters"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "전송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!master} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="h-4 w-4" /> RFI 리마인더 발송</DialogTitle>
        </DialogHeader>
        {master && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{master.rfi_no}</span> · 기한 {master.due_date ?? "-"} · <Badge variant="outline">{master.status}</Badge>
            </div>

            <div>
              <Label className="text-xs">수신자</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 mt-1 grid grid-cols-2 gap-1">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`text-left text-xs px-2 py-1 rounded ${selected.includes(m.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.map((id) => {
                    const name = members.find((m) => m.id === id)?.name ?? id;
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(id)} />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">메시지</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className="mt-1 text-sm" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>취소</Button>
          <Button onClick={send} disabled={sending || selected.length === 0 || !message.trim()}>
            <BellRing className="h-4 w-4 mr-1" /> 발송 ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
