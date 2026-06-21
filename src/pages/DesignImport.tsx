import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ImportShell } from "@/components/mdr/import/ImportShell";

export default function DesignImport() {
  const { isAdminOrPm, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/design")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Design Import</h1>
      </div>

      <ImportShell
        onImported={() => {
          qc.invalidateQueries({ queryKey: ["mdr_buildings"] });
          qc.invalidateQueries({ queryKey: ["mdr_drawings"] });
          qc.invalidateQueries({ queryKey: ["mdr_drawings_sheets"] });
          qc.invalidateQueries({ queryKey: ["mdr_snapshots"] });
          qc.invalidateQueries({ queryKey: ["mdr_import_logs"] });
        }}
      />
    </div>
  );
}
