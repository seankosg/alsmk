import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";

interface SelectRecipientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}

export function SelectRecipientsDialog({ open, onOpenChange, selectedIds, onConfirm }: SelectRecipientsDialogProps) {
  const { memberId } = useAuthContext();
  const [localIds, setLocalIds] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState("");

  // Reset local state when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setLocalIds(selectedIds);
      setSearch("");
    }
    onOpenChange(o);
  };

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
      const { data, error } = await supabase.from("teams").select("id, name, code").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const otherMembers = members.filter((m) => m.id !== memberId);
  const filtered = otherMembers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const grouped = useMemo(() => {
    const teamMap = new Map<string, { name: string; code: string; members: typeof filtered }>();
    const unassigned: typeof filtered = [];

    for (const team of teams) {
      teamMap.set(team.id, { name: team.name, code: team.code, members: [] });
    }

    for (const m of filtered) {
      if (m.team_id && teamMap.has(m.team_id)) {
        teamMap.get(m.team_id)!.members.push(m);
      } else {
        unassigned.push(m);
      }
    }

    const result: { key: string; label: string; members: typeof filtered }[] = [];
    for (const [id, t] of teamMap) {
      if (t.members.length > 0) {
        result.push({ key: id, label: `${t.name} (${t.code})`, members: t.members });
      }
    }
    if (unassigned.length > 0) {
      result.push({ key: "unassigned", label: "미배정", members: unassigned });
    }
    return result;
  }, [filtered, teams]);

  const toggle = (id: string) => {
    setLocalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTeam = (memberIds: string[], allSelected: boolean) => {
    setLocalIds((prev) => {
      if (allSelected) return prev.filter((id) => !memberIds.includes(id));
      const toAdd = memberIds.filter((id) => !prev.includes(id));
      return [...prev, ...toAdd];
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>수신자 선택</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <ScrollArea className="max-h-[360px]">
          {grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {search ? "검색 결과가 없습니다" : "멤버가 없습니다"}
            </p>
          ) : (
            <Accordion type="multiple" defaultValue={grouped.map((g) => g.key)} className="w-full">
              {grouped.map((group) => {
                const allSelected = group.members.every((m) => localIds.includes(m.id));
                const someSelected = group.members.some((m) => localIds.includes(m.id));
                return (
                  <AccordionItem key={group.key} value={group.key} className="border-b-0">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          ref={undefined}
                          data-indeterminate={someSelected && !allSelected ? "true" : undefined}
                          onCheckedChange={() => toggleTeam(group.members.map((m) => m.id), allSelected)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-medium">{group.label}</span>
                        <span className="text-xs text-muted-foreground">({group.members.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-1">
                      <div className="space-y-0.5 pl-2">
                        {group.members.map((m) => (
                          <label
                            key={m.id}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <Checkbox checked={localIds.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                            <span className="text-sm">{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>취소</Button>
          <Button onClick={() => { onConfirm(localIds); onOpenChange(false); }}>
            {localIds.length > 0 ? `확인 (${localIds.length}명)` : "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
