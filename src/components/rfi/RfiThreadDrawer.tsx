import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface Event {
  id: string;
  rfi_no: string;
  raw_no: number | null;
  raw_status: string | null;
  direction: string | null;
  event_type: string | null;
  from_party: string | null;
  to_party: string | null;
  title: string | null;
  issue_date: string | null;
  due_date: string | null;
  finish_date: string | null;
  source_filename: string | null;
}

export function RfiThreadDrawer({ rfiNo, onOpenChange }: { rfiNo: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["rfi_events_thread", rfiNo],
    enabled: !!rfiNo,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rfi_events")
        .select("*")
        .eq("rfi_no", rfiNo)
        .order("issue_date", { ascending: true });
      if (error) throw error;
      return (data as Event[]) ?? [];
    },
  });

  return (
    <Sheet open={!!rfiNo} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{rfiNo}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">로딩 중...</div>}
          {!isLoading && events.length === 0 && <div className="text-sm text-muted-foreground">이벤트 없음</div>}
          {events.map((e) => (
            <div key={e.id} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{e.event_type ?? "-"}</Badge>
                <Badge variant="outline">{e.direction ?? "-"}</Badge>
                <span className="text-muted-foreground">{e.issue_date ?? "-"}</span>
                {e.due_date && <span className="text-muted-foreground">· due {e.due_date}</span>}
                {e.finish_date && <span className="text-muted-foreground">· done {e.finish_date}</span>}
              </div>
              <div className="text-sm">{e.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>{e.from_party ?? "?"}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{e.to_party ?? "?"}</span>
              </div>
              {e.source_filename && (
                <div className="text-[11px] text-muted-foreground truncate">source: {e.source_filename}</div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
