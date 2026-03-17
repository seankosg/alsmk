import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockActivityLog } from "@/lib/mockData";

export function ActivityStream() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity Stream</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
          {mockActivityLog.map((entry) => {
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
      </CardContent>
    </Card>
  );
}
