import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/trustvault.functions";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/format";
import { PageHeader, meQuery, roleLabel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — TrustVault" }, { name: "description", content: "Your account settings." }] }),
  component: Profile,
});

function Profile() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => { if (me) setName(me.displayName); }, [me]);
  if (!me) return null;
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Profile" subtitle="Account details and security" />
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="text-sm text-muted-foreground">Email</div><div>{me.email}</div>
        <div className="mt-3 text-sm text-muted-foreground">Role</div><div>{roleLabel(me.roles)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Roles are assigned by administrators and cannot be changed here.</p>
      </div>
      <form className="space-y-3 rounded-lg border bg-card p-5 shadow-card" onSubmit={async (e) => {
        e.preventDefault();
        try { await updateProfile({ data: { displayName: name } }); toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["me"] }); }
        catch (err) { toast.error(errMsg(err)); }
      }}>
        <Label htmlFor="dn">Display name</Label>
        <Input id="dn" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Save</Button>
      </form>
      <form className="space-y-3 rounded-lg border bg-card p-5 shadow-card" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
        const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
        if (error) { toast.error(error.message); return; }
        toast.success("Password changed"); setPw(""); setCur("");
      }}>
        <h2 className="font-semibold">Change password</h2>
        <Label htmlFor="cur">Current password</Label>
        <Input id="cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <Label htmlFor="np">New password</Label>
        <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit">Update password</Button>
      </form>
    </div>
  );
}
