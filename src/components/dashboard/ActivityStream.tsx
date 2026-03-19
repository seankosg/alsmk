import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorCard } from "./QueryErrorCard";

export function ActivityStream() {
  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["activity_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    staleTime: 15_000,
  });

  if (isError) {
    return <QueryErrorCard title="Activity Stream" onRetry={() => refetch()} />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity Stream</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
            {logs.map((entry) => {
              const date = new Date(entry.created_at);
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{entry.user_name}</span>{" "}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
