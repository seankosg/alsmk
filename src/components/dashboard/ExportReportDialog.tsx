import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, Presentation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportDashboardExcel, exportDashboardPptxWithCaptures } from "@/lib/dashboardExport";

export interface ExportSection {
  id: string;
  label: string;
}

const SECTIONS: ExportSection[] = [
  { id: "milestone-timeline", label: "Milestone Timeline" },
  { id: "project-hud", label: "Project HUD (KPI)" },
  { id: "team-progress", label: "Team Progress Chart" },
  { id: "category-progress", label: "Category Progress Chart" },
  { id: "behind-schedule", label: "Behind Schedule Board" },
  { id: "critical-issues", label: "Critical Issue Board" },
  { id: "upcoming-deadlines", label: "Upcoming Deadlines" },
  { id: "issue-trend", label: "Issue Trend Chart" },
  { id: "team-heatmap", label: "Team Heatmap" },
  { id: "part-status", label: "Part Status Board" },
];

export function ExportReportDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(SECTIONS.map((s) => s.id)));
  const [exporting, setExporting] = useState<"excel" | "pptx" | null>(null);

  const toggleSection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === SECTIONS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SECTIONS.map((s) => s.id)));
    }
  };

  const handleExport = async (type: "excel" | "pptx") => {
    if (selected.size === 0) {
      toast.warning("내보낼 섹션을 하나 이상 선택하세요.");
      return;
    }
    setExporting(type);
    toast.info(type === "excel" ? "Excel 보고서 생성 중..." : "PPT 슬라이드 생성 중...");
    try {
      if (type === "excel") {
        await exportDashboardExcel();
      } else {
        await exportDashboardPptxWithCaptures(Array.from(selected));
      }
      toast.success("보고서가 다운로드되었습니다.");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("보고서 생성에 실패했습니다.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>보고서 내보내기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox
              id="select-all"
              checked={selected.size === SECTIONS.length}
              onCheckedChange={toggleAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              전체 선택
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {selected.size}/{SECTIONS.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
            {SECTIONS.map((section) => (
              <div key={section.id} className="flex items-center gap-2">
                <Checkbox
                  id={section.id}
                  checked={selected.has(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                />
                <label htmlFor={section.id} className="text-sm cursor-pointer">
                  {section.label}
                </label>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              className="flex-1"
              variant="outline"
              disabled={!!exporting}
              onClick={() => handleExport("excel")}
            >
              {exporting === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel (.xlsx)
            </Button>
            <Button
              className="flex-1"
              disabled={!!exporting}
              onClick={() => handleExport("pptx")}
            >
              {exporting === "pptx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Presentation className="h-4 w-4" />
              )}
              PowerPoint (.pptx)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
