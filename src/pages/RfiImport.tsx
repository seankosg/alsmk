import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { RfiImportShell } from "@/components/rfi/import/RfiImportShell";

export default function RfiImport() {
  const { isAdminOrPm, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/design/rfi")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">RFI Import</h1>
      </div>

      <RfiImportShell
        onImported={() => {
          qc.invalidateQueries({ queryKey: ["rfi_masters"] });
          qc.invalidateQueries({ queryKey: ["rfi_events"] });
          qc.invalidateQueries({ queryKey: ["rfi_import_logs"] });
        }}
      />
    </div>
  );
}
