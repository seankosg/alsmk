import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Database } from "lucide-react";

export function DesignManagementCard() {
  return (
    <Link to="/design">
      <Card className="p-4 hover:bg-accent/40 transition-colors cursor-pointer h-full">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2"><Database className="h-5 w-5 text-primary" /></div>
          <div>
            <div className="font-semibold">Design Management</div>
            <div className="text-xs text-muted-foreground">MDR 도면 진척 (SD/DD/CD)</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
