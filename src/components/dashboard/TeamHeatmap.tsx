import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockTeams, mockParts, mockTasks } from "@/lib/mockData";

export function TeamHeatmap() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Team Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockTeams.map((team) => {
            const parts = mockParts.filter(p => p.team_id === team.id);
            return (
              <div key={team.id}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{team.name} ({team.code})</p>
                <div className="flex flex-wrap gap-2">
                  {parts.map((part) => {
                    const partTasks = mockTasks.filter(t => t.part_id === part.id);
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
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
