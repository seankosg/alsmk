import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface QueryErrorCardProps {
  title: string;
  onRetry: () => void;
}

export function QueryErrorCard({ title, onRetry }: QueryErrorCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm">데이터를 불러오지 못했습니다</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            다시 시도
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
