import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Download, Copy, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { MDR_BULK_FIELDS, applyMdrBulkUpdate, applyMdrBulkDelete, type MdrBulkField } from "@/lib/mdr/bulkEdit";
import type { MdrDrawingRow } from "./columns";

interface Props {
  selectedRows: MdrDrawingRow[];
  onClearSelection: () => void;
  visibleColumnIds: string[];
  userName: string | null;
  canEdit: boolean;
}

export function MdrBulkActionBar({ selectedRows, onClearSelection, visibleColumnIds, userName, canEdit }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [field, setField] = useState<MdrBulkField>("discipline");
  const [value, setValue] = useState<string>("");
  const [blank, setBlank] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canEdit || selectedRows.length === 0) return null;

  const fieldDef = MDR_BULK_FIELDS.find((f) => f.field === field)!;
  const effectiveValue = blank ? null : value;
  const canApply = blank || !!value;

  const ids = selectedRows.map((r) => r.id);

  const exportXlsx = async () => {
    try {
      const XLSX: any = await import(/* @vite-ignore */ "xlsx").catch(() => null);
      if (!XLSX) {
        toast({ title: "xlsx 라이브러리 누락", description: "엔진이 설치되지 않았습니다.", variant: "destructive" });
        return;
      }
      const cols = visibleColumnIds.filter((c) => c !== "__select__");
      const rows = selectedRows.map((r) => {
        const o: Record<string, any> = {};
        cols.forEach((c) => { o[c] = (r as any)[c] ?? ""; });
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Selected");
      XLSX.writeFile(wb, `mdr_selected_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      toast({ title: "Export 실패", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const copyTsv = async () => {
    const cols = visibleColumnIds.filter((c) => c !== "__select__");
    const header = cols.join("\t");
    const body = selectedRows.map((r) => cols.map((c) => (r as any)[c] ?? "").join("\t")).join("\n");
    await navigator.clipboard.writeText(`${header}\n${body}`);
    toast({ title: "복사됨", description: `${selectedRows.length}행 TSV 클립보드 복사` });
  };

  const handleApply = async () => {
    setBusy(true);
    try {
      const res = await applyMdrBulkUpdate({ ids, field, value: effectiveValue, userName });
      await queryClient.invalidateQueries({ queryKey: ["mdr_drawings"] });
      if (res.failed === 0) {
        toast({ title: "일괄 수정 완료", description: `${res.ok}행 갱신` });
      } else {
        toast({
          title: "일부 실패",
          description: `성공 ${res.ok} / 실패 ${res.failed}`,
          variant: "destructive",
        });
      }
      setConfirmOpen(false);
      onClearSelection();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Badge variant="secondary" className="font-semibold">{selectedRows.length} selected</Badge>

        <div className="mx-2 h-5 w-px bg-border" />

        <Select value={field} onValueChange={(v) => { setField(v as MdrBulkField); setValue(""); setBlank(false); }}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MDR_BULK_FIELDS.map((f) => (
              <SelectItem key={f.field} value={f.field} className="text-xs">
                <span className="text-muted-foreground">[{f.group}]</span> {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {fieldDef.inputType === "select" && (
          <Select value={value} onValueChange={setValue} disabled={blank}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="값 선택" /></SelectTrigger>
            <SelectContent>
              {fieldDef.options!.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fieldDef.inputType === "date" && (
          <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} disabled={blank} className="h-8 w-[150px] text-xs" />
        )}
        {fieldDef.inputType === "text" && (
          <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={blank} placeholder="새 값" className="h-8 w-[200px] text-xs" />
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <Checkbox checked={blank} onCheckedChange={(c) => { setBlank(!!c); if (c) setValue(""); }} className="h-3.5 w-3.5" />
          Blank
        </label>

        <Button size="sm" className="h-8" disabled={!canApply || busy} onClick={() => setConfirmOpen(true)}>
          Apply
        </Button>

        <div className="mx-2 h-5 w-px bg-border" />

        <Button size="sm" variant="outline" className="h-8" onClick={exportXlsx}>
          <Download className="mr-1 h-3.5 w-3.5" /> .xlsx
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={copyTsv}>
          <Copy className="mr-1 h-3.5 w-3.5" /> TSV
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={onClearSelection}>
          <X className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>일괄 수정 확인</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{selectedRows.length}행</span>의 <span className="font-mono">{fieldDef.label}</span> 값을{" "}
              {blank ? <em>Blank(NULL)</em> : <code className="rounded bg-muted px-1">{value}</code>}로 변경합니다.
              500행씩 배치 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-auto rounded border text-xs">
            <table className="w-full">
              <thead className="bg-muted">
                <tr><th className="px-2 py-1 text-left">item_no</th><th className="px-2 py-1 text-left">Before</th><th className="px-2 py-1 text-left">After</th></tr>
              </thead>
              <tbody>
                {selectedRows.slice(0, 5).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1 font-mono">{r.item_no}</td>
                    <td className="px-2 py-1 text-muted-foreground">{(r as any)[field] ?? "—"}</td>
                    <td className="px-2 py-1 font-semibold">{blank ? "—" : value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedRows.length > 5 && (
              <p className="px-2 py-1 text-muted-foreground">…외 {selectedRows.length - 5}행</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>취소</Button>
            <Button onClick={handleApply} disabled={busy}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
