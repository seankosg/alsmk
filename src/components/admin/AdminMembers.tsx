import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserPlus, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useAuthContext } from "@/components/layout/AppLayout";

type Member = Tables<"members">;

export function AdminMembers() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [dutyTitle, setDutyTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [partId, setPartId] = useState("");

  // Account creation dialog
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMember, setAccountMember] = useState<Member | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  // Password reset dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: adminUserIds = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (error) throw error;
      return data.map((r) => r.user_id);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        duty_title: dutyTitle || null,
        team_id: teamId || null,
        part_id: partId || null,
      };
      if (editing) {
        const { error } = await supabase.from("members").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("members").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success(editing ? "Member updated" : "Member added");
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!accountMember) throw new Error("No member selected");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "create",
          email: accountEmail,
          password: accountPassword,
          member_id: accountMember.id,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      const msg = data?.is_first_user
        ? "Account created — first user, admin role granted automatically!"
        : "Account created";
      toast.success(msg);
      setAccountOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPwd = useMutation({
    mutationFn: async () => {
      if (!resetMember?.user_id) throw new Error("No user linked");
      const res = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "reset-password",
          user_id: resetMember.user_id,
          password: resetPassword,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Password reset");
      setResetOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      const res = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "toggle-admin", user_id: userId, grant },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setName("");
    setDutyTitle("");
    setTeamId("");
    setPartId("");
    setOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setName(m.name);
    setDutyTitle(m.duty_title ?? "");
    setTeamId(m.team_id);
    setPartId(m.part_id ?? "");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
  }

  function openCreateAccount(m: Member) {
    setAccountMember(m);
    setAccountEmail((m as any).email ?? "");
    setAccountPassword("");
    setAccountOpen(true);
  }

  function openResetPassword(m: Member) {
    setResetMember(m);
    setResetPassword("");
    setResetOpen(true);
  }

  const getTeamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? "—";
  const getPartName = (pid: string | null) => pid ? (parts.find(p => p.id === pid)?.name ?? "—") : "—";
  const filteredParts = parts.filter(p => p.team_id === teamId);
  const isMemberAdmin = (m: Member) => m.user_id ? adminUserIds.includes(m.user_id) : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Members</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Member</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Duty Title</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.name}
                  {isMemberAdmin(m) && (
                    <Badge variant="outline" className="ml-2 text-[10px] border-primary text-primary">Admin</Badge>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline">{getTeamName(m.team_id)}</Badge></TableCell>
                <TableCell className="text-xs">{getPartName(m.part_id)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.duty_title ?? "—"}</TableCell>
                <TableCell>
                  {m.user_id ? (
                    <Badge className="bg-primary/20 text-primary text-[10px]">Connected</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">No Account</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!m.user_id ? (
                      <Button variant="ghost" size="icon" onClick={() => openCreateAccount(m)} title="Create Account">
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openResetPassword(m)} title="Reset Password">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAdmin.mutate({ userId: m.user_id!, grant: !isMemberAdmin(m) })}
                            title={isMemberAdmin(m) ? "Remove Admin" : "Grant Admin"}
                          >
                            {isMemberAdmin(m) ? (
                              <ShieldOff className="h-3.5 w-3.5 text-warning" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit/Add Member Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Member" : "New Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={(v) => { setTeamId(v); setPartId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Part (optional)</Label>
              <Select value={partId} onValueChange={setPartId}>
                <SelectTrigger><SelectValue placeholder="Select part" /></SelectTrigger>
                <SelectContent>
                  {filteredParts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duty Title</Label>
              <Input value={dutyTitle} onChange={e => setDutyTitle(e.target.value)} placeholder="e.g. Lead Engineer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || !teamId || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Account for {accountMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Password</Label>
              <Input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAccount.mutate()}
              disabled={!accountEmail || accountPassword.length < 6 || createAccount.isPending}
            >
              {createAccount.isPending ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              onClick={() => resetPwd.mutate()}
              disabled={resetPassword.length < 6 || resetPwd.isPending}
            >
              {resetPwd.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
