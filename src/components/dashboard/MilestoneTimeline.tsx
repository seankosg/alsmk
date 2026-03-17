import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockMilestones } from "@/lib/mockData";
import { CheckCircle, Clock, Circle, AlertTriangle } from "lucide-react";

const statusConfig = {
  completed: { icon: CheckCircle, color: "text-success", bg: "bg-success" },
  in_progress: { icon: Clock, color: "text-primary", bg: "bg-primary" },
  upcoming: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted-foreground" },
  delayed: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive" },
};

export function MilestoneTimeline() {
  const today = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Milestone Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-0 min-w-[600px] px-4 py-6">
            {mockMilestones.map((ms, i) => {
              const cfg = statusConfig[ms.status];
              const Icon = cfg.icon;
              const targetDate = new Date(ms.target_date);
              const isPast = targetDate < today;

              return (
                <div key={ms.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 relative">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      ms.status === 'completed' ? 'bg-success/20' :
                      ms.status === 'in_progress' ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <span className="text-xs font-medium text-center max-w-[100px] leading-tight">
                      {ms.name}
                    </span>
                    <span className={`text-[10px] ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                  {i < mockMilestones.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      ms.status === 'completed' ? 'bg-success/50' : 'bg-border'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
