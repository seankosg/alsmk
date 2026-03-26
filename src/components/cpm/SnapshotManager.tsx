import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Save, Upload, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuthContext } from "@/components/layout/AppLayout";

interface Snapshot {
  id: string;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

interface SnapshotManagerProps {
  onLoadSnapshot: (snapshot: any) => void;
  onRequestCurrentSnapshot: () => void;
  pendingSnapshot: any | null;
  onSnapshotHandled: () => void;
}

export function SnapshotManager({
  onLoadSnapshot,
  onRequestCurrentSnapshot,
  pendingSnapshot,
  onSnapshotHandled,
}: SnapshotManagerProps) {
  const { isAdminOrPm } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [saveName, setSaveName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cpm_snapshots")
      .select("id, name, data, created_at, updated_at")
      .order("updated_at", { ascending: false });
    setSnapshots((data as Snapshot[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchSnapshots();
  }, [open, fetchSnapshots]);

  // When pendingSnapshot arrives (from iframe), save it
  useEffect(() => {
    if (!pendingSnapshot || !saving) return;
    const doSave = async () => {
      const name = saveName.trim() || "default";

      const { data: existing } = await supabase
        .from("cpm_snapshots")
        .select("id")
        .eq("name", name)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();
      const snapData = { ...pendingSnapshot, name };

      if (existing) {
        await supabase
          .from("cpm_snapshots")
          .update({ data: snapData, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("cpm_snapshots")
          .insert({ name, data: snapData, created_by: user?.id || null });
      }

      toast.success(`"${name}" 저장 완료`);
      setSaveName("");
      setSaving(false);
      onSnapshotHandled();
      fetchSnapshots();
    };
    doSave();
  }, [pendingSnapshot, saving]);

  const handleSave = () => {
    if (!saveName.trim()) {
      toast.error("스냅샷 이름을 입력하세요");
      return;
    }
    setSaving(true);
    onRequestCurrentSnapshot();
  };

  const handleLoad = (snap: Snapshot) => {
    onLoadSnapshot(snap.data);
    toast.success(`"${snap.name}" 불러오기 완료`);
    setOpen(false);
  };

  const handleDelete = async (snap: Snapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`"${snap.name}" 스냅샷을 삭제하시겠습니까?`)) return;
    await supabase.from("cpm_snapshots").delete().eq("id", snap.id);
    toast.success(`"${snap.name}" 삭제됨`);
    fetchSnapshots();
  };

  const getActivityCount = (snap: Snapshot) => {
    try {
      return snap.data?.activities?.length || snap.data?.actCount || 0;
    } catch {
      return 0;
    }
  };

  const getCpCount = (snap: Snapshot) => {
    try {
      return snap.data?.cpCount || snap.data?.activities?.filter((a: any) => a.isCritical)?.length || 0;
    } catch {
      return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-background/80 backdrop-blur border-border hover:bg-accent/20"
        >
          <Database className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Snapshots</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" />
            CPM 스냅샷 관리
          </DialogTitle>
        </DialogHeader>

        {/* Save new — Admin only */}
        {isAdmin && (
          <div className="flex gap-2">
            <Input
              placeholder="스냅샷 이름 입력..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="text-sm h-9"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
              className="gap-1.5 shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              저장
            </Button>
          </div>
        )}

        {/* List */}
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">불러오는 중...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              저장된 스냅샷이 없습니다
              <br />
              <span className="text-xs">XML 업로드 후 계산하고 이름을 입력해 저장하세요</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="group flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/60 transition-colors cursor-pointer"
                  onClick={() => handleLoad(snap)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {snap.name}
                      {snap.name === "auto" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                          자동저장
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{getActivityCount(snap)}개 Activity</span>
                      <span>·</span>
                      <span>CP {getCpCount(snap)}개</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {format(new Date(snap.updated_at), "yyyy-MM-dd HH:mm")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleLoad(snap)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(snap, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
