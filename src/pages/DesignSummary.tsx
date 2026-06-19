import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { History } from "lucide-react";
import { MdrSummaryPanel } from "@/components/mdr/MdrSummaryPanel";

export default function DesignSummary() {
  const { isAdminOrPm, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <History className="h-6 w-6" />
        Design Summary
      </h1>
      <MdrSummaryPanel />
    </div>
  );
}
