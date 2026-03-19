import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

interface TaskCardProps {
  taskCode: string | null;
  title: string;
  issueFlag?: "normal" | "warning" | "critical";
  onClick?: () => void;
}

export function TaskCard({ taskCode, title, issueFlag = "normal", onClick }: TaskCardProps) {
  return (
    <Card
      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors border-primary/30 bg-primary/5"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <ClipboardList className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-muted-foreground">{taskCode ?? "—"}</p>
          <p className="text-sm font-medium truncate">{title}</p>
        </div>
        {issueFlag !== "normal" && (
          <Badge
            variant={issueFlag === "critical" ? "destructive" : "outline"}
            className={`shrink-0 text-[10px] ${issueFlag === "warning" ? "border-warning text-warning" : ""}`}
          >
            {issueFlag}
          </Badge>
        )}
      </div>
    </Card>
  );
}
