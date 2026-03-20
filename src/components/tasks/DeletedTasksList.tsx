import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/components/layout/AppLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { differenceInMinutes } from "date-fns";

export function DeletedTasksList() {
  const { memberId, isAdmin } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: deletedTasks = [], isLoading } = useQuery({
    queryKey: ["deleted-tasks", memberId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("id, title, task_code, deleted_at, deleted_by, assignee_id, team_id")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (!isAdmin && memberId) {
        query = query.eq("deleted_by", memberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 10_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const getMemberName = (id: string | null) =>
    !id ? "Unknown" : members.find((m) => m.id === id)?.name ?? "Unknown";

  const getTimeRemaining = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const expiresAt = new Date(deletedDate.getTime() + 48 * 60 * 60 * 1000);
    const minutesLeft = differenceInMinutes(expiresAt, new Date());
    if (minutesLeft <= 0) return "곧 영구 삭제";
    const hours = Math.floor(minutesLeft / 60);
    const mins = minutesLeft % 60;
    return hours > 0 ? `${hours}시간 ${mins}분 남음` : `${mins}분 남음`;
  };

  const handleRestore = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: null, deleted_by: null } as any)
        .eq("id", taskId);
      if (error) throw error;
      toast.success("태스크가 복원되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-tasks"] });
    } catch (err: any) {
      toast.error(err.message || "복원 실패");
    }
  };

  const handlePermanentDelete = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      toast.success("영구 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["deleted-tasks"] });
    } catch (err: any) {
      toast.error(err.message || "삭제 실패");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (deletedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Trash2 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">휴지통이 비어있습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      <p className="text-xs text-muted-foreground px-1 mb-3">
        삭제된 태스크는 48시간 후 자동으로 영구 삭제됩니다.
      </p>
      {deletedTasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <code className="text-xs text-muted-foreground">{task.task_code ?? "—"}</code>
              <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                <Clock className="h-3 w-3 mr-1" />
                {getTimeRemaining(task.deleted_at!)}
              </Badge>
            </div>
            <p className="text-sm font-medium truncate">{task.title}</p>
            {isAdmin && task.deleted_by && (
              <p className="text-[10px] text-muted-foreground">
                삭제자: {getMemberName(task.deleted_by)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(task.id)}
              className="h-8 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              복원
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>영구 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 태스크를 영구적으로 삭제합니다. 이 작업은 취소할 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handlePermanentDelete(task.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      영구 삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
