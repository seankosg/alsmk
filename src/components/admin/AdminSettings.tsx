import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, Download, Upload, Trash2, Database, Clock, History, Activity, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [pmName, setPmName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [backupName, setBackupName] = useState("");

  // Auto backup settings
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoInterval, setAutoInterval] = useState("daily");
  const [autoRetention, setAutoRetention] = useState("30");

  // KUKU KPI thresholds
  const [kukuDelayThreshold, setKukuDelayThreshold] = useState("5");
  const [kukuPredThreshold, setKukuPredThreshold] = useState("5");

  // CPM 검증 모드 잠금
  const [cpmLocked, setCpmLocked] = useState(false);

  // PM Name
  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ["project_settings", "pm_name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_settings")
        .select("value")
        .eq("key", "pm_name")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });

  useEffect(() => {
    if (pmData !== undefined) setPmName(pmData);
  }, [pmData]);

  // Auto backup settings from project_settings
  const { data: backupSettings } = useQuery({
    queryKey: ["project_settings", "backup_and_kuku"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_settings")
        .select("key, value")
        .in("key", ["auto_backup_enabled", "auto_backup_interval", "auto_backup_retention", "kuku_delay_threshold", "kuku_pred_threshold"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => (map[r.key] = r.value));
      return map;
    },
  });

  useEffect(() => {
    if (backupSettings) {
      setAutoEnabled(backupSettings.auto_backup_enabled === "true");
      setAutoInterval(backupSettings.auto_backup_interval || "daily");
      setAutoRetention(backupSettings.auto_backup_retention || "30");
      setKukuDelayThreshold(backupSettings.kuku_delay_threshold || "5");
      setKukuPredThreshold(backupSettings.kuku_pred_threshold || "5");
    }
  }, [backupSettings]);

  // Backup history
  const { data: backups = [], isLoading: backupsLoading } = useQuery({
    queryKey: ["data_backups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_backups")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const savePm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_settings")
        .upsert({ key: "pm_name", value: pmName, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_settings"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveKukuThresholds = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const rows = [
        { key: "kuku_delay_threshold", value: kukuDelayThreshold, updated_at: now },
        { key: "kuku_pred_threshold", value: kukuPredThreshold, updated_at: now },
      ];
      const { error } = await supabase.from("project_settings").upsert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_settings"] });
      queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
      toast.success("KUKU threshold settings saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveBackupSettings = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const rows = [
        { key: "auto_backup_enabled", value: String(autoEnabled), updated_at: now },
        { key: "auto_backup_interval", value: autoInterval, updated_at: now },
        { key: "auto_backup_retention", value: autoRetention, updated_at: now },
      ];
      const { error } = await supabase.from("project_settings").upsert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_settings"] });
      toast.success("Backup settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  // Manual backup download
  const exportBackup = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("backup-export", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async (data) => {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });

      // Try File System Access API for save-as dialog
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `backup_${new Date().toISOString().slice(0, 10)}.json`,
            types: [{ description: "JSON Files", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("Backup saved successfully");
          return;
        } catch (err: any) {
          if (err.name === "AbortError") return; // User cancelled
        }
      }

      // Fallback for browsers without File System Access API
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    },
    onError: (e) => toast.error(e.message),
  });

  // Save backup to DB
  const saveBackupToDb = useMutation({
    mutationFn: async (name: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("backup-export", {
        body: { save_to_db: true, backup_name: name },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data_backups"] });
      toast.success("Backup saved to database");
      setShowSaveDialog(false);
      setBackupName("");
    },
    onError: (e) => toast.error(e.message),
  });

  // Import/restore
  const importBackup = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const json = JSON.parse(text);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("backup-import", {
        body: json,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      const errors = Object.entries(data.results ?? {})
        .filter(([, v]: any) => v.error)
        .map(([k, v]: any) => `${k}: ${v.error}`);
      if (errors.length > 0) {
        toast.warning(`Restored with ${errors.length} errors: ${errors.join("; ")}`);
      } else {
        toast.success("Backup restored successfully");
      }
      setConfirmRestore(false);
      setRestoreFile(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setConfirmRestore(false);
    },
  });

  // Delete a backup
  const deleteBackup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("data_backups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data_backups"] });
      toast.success("Backup deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Download a backup from DB
  const downloadFromDb = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("data_backups")
        .select("data, name, created_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const fileName = `${data.name}_${data.created_at.slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: "JSON Files", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("Backup saved successfully");
          return;
        } catch (err: any) {
          if (err.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setConfirmRestore(true);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Project Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label>Project Manager Name</Label>
            <Input
              value={pmName}
              onChange={(e) => setPmName(e.target.value)}
              placeholder="Enter PM name"
              disabled={pmLoading}
            />
          </div>
          <Button onClick={() => savePm.mutate()} disabled={savePm.isPending || !pmName.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {savePm.isPending ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* KUKU KPI Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            KUKU KPI Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            CPM Summary Banner의 복합 KPI 카드에서 사용하는 지연 판별 기준값을 설정합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label>Delayed KUKU Threshold (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={kukuDelayThreshold}
                onChange={(e) => setKukuDelayThreshold(e.target.value)}
                placeholder="5"
              />
              <p className="text-[10px] text-muted-foreground">실제 진행률이 계획 대비 이 값(%) 이상 낮으면 지연으로 표시</p>
            </div>
            <div className="space-y-2">
              <Label>Pred Alert Threshold (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={kukuPredThreshold}
                onChange={(e) => setKukuPredThreshold(e.target.value)}
                placeholder="5"
              />
              <p className="text-[10px] text-muted-foreground">선행 Activity와의 Gap이 이 값(%) 이상 음수이면 경고로 표시</p>
            </div>
          </div>
          <Button onClick={() => saveKukuThresholds.mutate()} disabled={saveKukuThresholds.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveKukuThresholds.isPending ? "Saving…" : "Save Thresholds"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Manual Backup / Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => exportBackup.mutate()} disabled={exportBackup.isPending}>
              <Download className="h-4 w-4 mr-1" />
              {exportBackup.isPending ? "Exporting…" : "Download Backup (JSON)"}
            </Button>
            <Button onClick={() => { setBackupName(`backup_${new Date().toISOString().slice(0, 10)}`); setShowSaveDialog(true); }} variant="outline">
              <Database className="h-4 w-4 mr-1" />
              Save Backup to DB
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Restore from File
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          </div>
          <p className="text-xs text-muted-foreground">
            Backup includes all tables: tasks, teams, parts, members, milestones, calendar events, CPM data, messages, settings, and more.
          </p>
        </CardContent>
      </Card>

      {/* Auto Backup Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Automated Backup Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            <Label>Enable Automated Backups</Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label>Backup Interval</Label>
              <Select value={autoInterval} onValueChange={setAutoInterval}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Retention Period</Label>
              <Select value={autoRetention} onValueChange={setAutoRetention}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => saveBackupSettings.mutate()} disabled={saveBackupSettings.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveBackupSettings.isPending ? "Saving…" : "Save Schedule Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Backup History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups saved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => downloadFromDb.mutate(b.id)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteBackup.mutate(b.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Save Backup Name Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Backup</DialogTitle>
            <DialogDescription>
              Enter a name for this backup snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Backup Name</Label>
            <Input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g. before_migration_v2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveBackupToDb.mutate(backupName.trim() || `backup_${new Date().toISOString().slice(0, 10)}`)}
              disabled={saveBackupToDb.isPending}
            >
              {saveBackupToDb.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Data Restore</DialogTitle>
            <DialogDescription>
              This will overwrite existing data with the backup file. This action cannot be undone.
              Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            File: <span className="font-mono text-xs">{restoreFile?.name}</span>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmRestore(false); setRestoreFile(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restoreFile && importBackup.mutate(restoreFile)}
              disabled={importBackup.isPending}
            >
              {importBackup.isPending ? "Restoring…" : "Yes, Restore Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
