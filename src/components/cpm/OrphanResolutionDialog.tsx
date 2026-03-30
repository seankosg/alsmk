import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, ArrowRightLeft } from "lucide-react";

export interface OrphanActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  mpp_task_id: string | null;
  mappedTaskCount: number;
  mappedTaskIds: string[];
  semantic_key?: string | null;
  custom_fields?: Record<string, string> | null;
}

interface NewActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  semantic_key?: string | null;
  custom_fields?: Record<string, string> | null;
}

interface Props {
  orphans: OrphanActivity[];
  newActivities: NewActivity[];
  userName: string;
  onComplete: () => void;
}

export function OrphanResolutionDialog({ orphans, newActivities, userName, onComplete }: Props) {
  const [remaining, setRemaining] = useState<OrphanActivity[]>(orphans);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const logAction = async (orphan: OrphanActivity, action: "migrated" | "deleted", migratedTo?: string) => {
    await supabase.from("activity_log").insert({
      action: "cpm_activity_deleted",
      entity_type: "cpm_activity",
      entity_id: orphan.id,
      user_name: userName,
      details: {
        name: orphan.name,
        wbs_full: orphan.wbs_full,
        mpp_task_id: orphan.mpp_task_id,
        unmapped_task_ids: action === "deleted" ? orphan.mappedTaskIds : [],
        migrated_to: migratedTo ?? null,
        resolution: action,
      },
    });
  };

  const handleMigrate = async (orphan: OrphanActivity) => {
    const targetId = selectedTargets[orphan.id];
    if (!targetId) return;
    setProcessing(true);
    try {
      // Fix 4: Use RPC for atomic migration, merging with existing target mappings
      const { data: existingTargetMappings } = await supabase
        .from("cpm_task_mappings")
        .select("task_id")
        .eq("activity_id", targetId);
      const existingTaskIds = (existingTargetMappings || []).map((m) => m.task_id);
      const mergedTaskIds = [...new Set([...existingTaskIds, ...orphan.mappedTaskIds])];

      await supabase.rpc("upsert_activity_mappings", {
        _activity_id: targetId,
        _task_ids: mergedTaskIds,
      });
      // Delete orphan's old mappings and the activity itself
      await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
      await supabase.from("cpm_activities").delete().eq("id", orphan.id);
      await logAction(orphan, "migrated", targetId);
      const target = newActivities.find((a) => a.id === targetId);
      toast.success(`"${orphan.name}" 매핑이 "${target?.name}"(으)로 이전됨`);
      setRemaining((prev) => prev.filter((o) => o.id !== orphan.id));
    } catch (e) {
      console.error(e);
      toast.error("매핑 이전 실패");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (orphan: OrphanActivity) => {
    setProcessing(true);
    try {
      await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
      await supabase.from("cpm_activities").delete().eq("id", orphan.id);
      await logAction(orphan, "deleted");
      toast.success(`"${orphan.name}" 삭제됨 (${orphan.mappedTaskCount}개 매핑 해제)`);
      setRemaining((prev) => prev.filter((o) => o.id !== orphan.id));
    } catch (e) {
      console.error(e);
      toast.error("삭제 실패");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteAll = async () => {
    setProcessing(true);
    for (const orphan of remaining) {
      await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
      await supabase.from("cpm_activities").delete().eq("id", orphan.id);
      await logAction(orphan, "deleted");
    }
    toast.success(`${remaining.length}개 Activity 삭제 완료`);
    setRemaining([]);
    setProcessing(false);
  };

  const handleDone = async () => {
    // Fix 3: Warn about unresolved orphans with mappings, use Promise.all instead of forEach
    const withMappings = remaining.filter((o) => o.mappedTaskCount > 0);
    const withoutMappings = remaining.filter((o) => o.mappedTaskCount === 0);

    if (withMappings.length > 0) {
      toast.warning(`${withMappings.length}개 Activity에 미처리 매핑이 남아있습니다. 해당 매핑은 해제됩니다.`);
      // Clean up mappings for unresolved orphans
      await Promise.all(withMappings.map(async (orphan) => {
        await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
        await supabase.from("cpm_activities").delete().eq("id", orphan.id);
        await logAction(orphan, "deleted");
      }));
    }

    // Delete orphans without mappings
    await Promise.all(withoutMappings.map(async (orphan) => {
      await supabase.from("cpm_activities").delete().eq("id", orphan.id);
    }));

    onComplete();
  };

  return (
    <Dialog open={remaining.length > 0} onOpenChange={(open) => { if (!open) handleDone(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>CPM Activity 매핑 확인</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          새 XML에 없는 Activity 중 태스크 매핑이 있는 항목입니다. 매핑을 이전하거나 삭제하세요.
        </p>

        <div className="flex-1 overflow-auto space-y-3 min-h-0">
          {remaining.map((orphan) => (
            <div
              key={orphan.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{orphan.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(() => {
                    const cf = orphan.custom_fields || {};
                    const bldg = cf.BLDG || cf.Text2 || cf['텍스트2'];
                    const wbsParts = (orphan.wbs_full || '').split('.');
                    const wbsL2 = wbsParts.length >= 2 ? `${wbsParts[0]}.${wbsParts[1]}` : null;
                    return (
                      <>
                        {bldg && <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{bldg}</span>}
                        {wbsL2 && <span>WBS L2: {wbsL2}</span>}
                      </>
                    );
                  })()}
                  <span>WBS: {orphan.wbs_full ?? "-"}</span>
                  <span>· 매핑 {orphan.mappedTaskCount}개</span>
                </div>
              </div>

              <Select
                value={selectedTargets[orphan.id] ?? ""}
                onValueChange={(v) => setSelectedTargets((prev) => ({ ...prev, [orphan.id]: v }))}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="이전 대상 선택" />
                </SelectTrigger>
                <SelectContent>
                  {newActivities.map((a) => {
                    const cf = a.custom_fields || {};
                    const bldg = cf.BLDG || cf.Text2 || cf['텍스트2'] || '';
                    const wbsParts = (a.wbs_full || '').split('.');
                    const wbsL2 = wbsParts.length >= 2 ? `${wbsParts[0]}.${wbsParts[1]}` : '';
                    const label = [bldg, wbsL2, a.name].filter(Boolean).join(' · ');
                    return (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {label}
                      </SelectItem>
                    );
                  })}
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                disabled={!selectedTargets[orphan.id] || processing}
                onClick={() => handleMigrate(orphan)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                이전
              </Button>

              <Button
                size="sm"
                variant="destructive"
                disabled={processing}
                onClick={() => handleDelete(orphan)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                삭제
              </Button>
            </div>
          ))}

          {remaining.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">모든 항목이 처리되었습니다.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {remaining.length > 0 && (
            <Button variant="destructive" onClick={handleDeleteAll} disabled={processing}>
              전체 삭제 ({remaining.length})
            </Button>
          )}
          <Button onClick={handleDone} disabled={processing}>
            완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
