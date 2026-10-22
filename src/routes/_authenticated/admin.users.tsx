import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listUsers, setUserRole } from "@/lib/trustvault.functions";
import { errMsg, formatDate } from "@/lib/format";
import { PageHeader, roleLabel } from "@/components/app-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & Roles — TrustVault" }, { name: "description", content: "Manage user roles." }] }),
  component: Users,
});

function Users() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["users"], queryFn: () => listUsers(), retry: false });
  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error) return <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">{errMsg(error)}</p>;
  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="Administrator role is granted only through the database, never from this page." />
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Role</th></tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.roles.includes("admin") ? roleLabel(u.roles) : (
                    <Select value={u.roles.includes("owner") ? "owner" : "viewer"} onValueChange={async (v) => {
                      try { await setUserRole({ data: { userId: u.id, role: v as "owner" | "viewer" } }); toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["users"] }); }
                      catch (e) { toast.error(errMsg(e)); }
                    }}>
                      <SelectTrigger className="h-8 w-44" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="owner">Document Owner</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
                    </Select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
