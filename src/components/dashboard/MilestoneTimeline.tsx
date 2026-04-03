import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, Circle, AlertTriangle, CalendarClock } from "lucide-react";
import { QueryErrorCard } from "./QueryErrorCard";
import { differenceInDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  completed: { icon: CheckCircle, color: "text-success", bg: "bg-success" },
  in_progress: { icon: Clock, color: "text-primary", bg: "bg-primary" },
  upcoming: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted-foreground" },
  delayed: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive" },
};

export function MilestoneTimeline() {
  const { data: milestones = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (isError) {
    return <QueryErrorCard title="Milestone Timeline" onRetry={() => refetch()} />;
  }

  const today = startOfDay(new Date());

  // D-Day calculation: last milestone
  const finalMs = milestones[milestones.length - 1];
  const dDay = finalMs ? differenceInDays(parseLocalDate(finalMs.target_date), today) : null;

  // Calculate "today" position as percentage along the timeline
  const getElapsedPercent = () => {
    if (milestones.length < 2) return 0;
    const firstDate = parseLocalDate(milestones[0].target_date).getTime();
    const lastDate = parseLocalDate(milestones[milestones.length - 1].target_date).getTime();
    const range = lastDate - firstDate;
    if (range <= 0) return 100;
    const elapsed = today.getTime() - firstDate;
    return Math.max(0, Math.min(100, (elapsed / range) * 100));
  };

  const elapsedPercent = getElapsedPercent();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Milestone Timeline</CardTitle>
          {dDay !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold font-mono text-primary">
                {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : `D+${Math.abs(dDay)}`}
              </span>
              {finalMs && (
                <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">
                  {finalMs.name}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones configured</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="relative min-w-[600px] px-4 pt-8 pb-4">
              {/* Track line — aligned with circle centers */}
              <div className="absolute left-4 right-4 top-[calc(2rem+18px-1.5px)] h-[3px] bg-border rounded-full" />

              {/* Elapsed line */}
              <div className="absolute left-4 right-4 top-[calc(2rem+18px-1.5px)] h-[3px] pointer-events-none">
                <div
                  className="h-full bg-primary rounded-full shadow-[0_0_6px_hsl(var(--primary)/0.4)]"
                  style={{ width: `${elapsedPercent}%` }}
                />
              </div>

              {/* Today marker */}
              {elapsedPercent > 0 && elapsedPercent < 100 && milestones.length >= 1 && (() => {
                const firstDate = parseLocalDate(milestones[0].target_date);
                const elapsed = differenceInDays(today, firstDate);
                const label = elapsed === 0 ? "Today" : elapsed > 0 ? `+${elapsed}d` : `${elapsed}d`;
                return (
                  <div
                    className="absolute pointer-events-none flex flex-col items-center"
                    style={{
                      top: "calc(2rem + 18px - 1.5px)",
                      left: `calc(16px + (100% - 32px) * ${elapsedPercent / 100})`,
                      transform: "translate(-50%, -100%)",
                    }}
                  >
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 whitespace-nowrap mb-1">
                      {label}
                    </span>
                    <div className="w-0.5 h-2 bg-primary/40 rounded-full" />
                  </div>
                );
              })()}

              {/* Milestones: circles on bar, text below */}
              <div className="relative flex items-start gap-0">
                {milestones.map((ms, i) => {
                  const cfg = statusConfig[ms.status] ?? statusConfig.upcoming;
                  const Icon = cfg.icon;
                  const targetDate = parseLocalDate(ms.target_date);
                  const isPast = targetDate < today;
                  const diff = differenceInDays(targetDate, today);
                  const dLabel = diff > 0 ? `D-${diff}` : diff === 0 ? "D-Day" : `D+${Math.abs(diff)}`;

                  return (
                    <div key={ms.id} className="flex items-start flex-1">
                      <div className="flex flex-col items-center relative z-10">
                        {/* Circle on the bar */}
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                            ms.status === "completed"
                              ? "bg-success/20 border-success"
                              : ms.status === "in_progress"
                              ? "bg-primary/20 border-primary ring-2 ring-primary/20"
                              : ms.status === "delayed"
                              ? "bg-destructive/20 border-destructive"
                              : "bg-muted border-border"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        {/* Labels below */}
                        <span className="mt-2 text-xs font-medium text-center max-w-[100px] leading-tight">
                          {ms.name}
                        </span>
                        <span
                          className={`text-xs font-mono font-semibold mt-0.5 ${
                            isPast ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {targetDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </span>
                        <span className={`text-lg font-mono font-bold mt-0.5 ${
                          diff > 0 ? "text-primary" : diff === 0 ? "text-warning" : "text-destructive"
                        }`}>
                          {dLabel}
                        </span>
                      </div>
                      {i < milestones.length - 1 && <div className="flex-1" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
