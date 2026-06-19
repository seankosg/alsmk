import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

export default function DesignDashboard() {
  const { isAdminOrPm, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6" />
        Design Dashboard
      </h1>
      <Card className="p-8 text-center text-muted-foreground">
        Phase 2 예정: S-curve, 지연 분포, 가중치 롤업 차트
      </Card>
    </div>
  );
}
