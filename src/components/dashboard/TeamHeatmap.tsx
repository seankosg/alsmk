import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamHeatmap() {
  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: parts = [], isLoading: lp } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: tasks = [], isLoading: ltt } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const isLoading = lt || lp || ltt;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Team Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => {
              const teamParts = parts.filter(p => p.team_id === team.id);
              return (
                <div key={team.id}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{team.name} ({team.code})</p>
                  <div className="flex flex-wrap gap-2">
                    {teamParts.map((part) => {
                      const partTasks = tasks.filter(t => t.part_id === part.id);
                      const hasCritical = partTasks.some(t => t.issue_flag === "critical");
                      const hasWarning = partTasks.some(t => t.issue_flag === "warning");
                      const bg = hasCritical ? "bg-destructive/20 border-destructive/40 text-destructive" :
                                 hasWarning ? "bg-warning/20 border-warning/40 text-warning" :
                                 "bg-success/20 border-success/40 text-success";
                      return (
                        <div key={part.id} className={`px-3 py-2 rounded-md border text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${bg}`}>
                          {part.name}
                          <span className="ml-1.5 opacity-70">({partTasks.length})</span>
                        </div>
                      );
                    })}
                    {teamParts.length === 0 && (
                      <span className="text-xs text-muted-foreground">No parts</span>
                    )}
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
