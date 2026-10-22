import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { listAuditLogs } from "@/lib/trustvault.functions";
import { errMsg, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — TrustVault" }, { name: "description", content: "Administrator audit trail." }] }),
  component: Audit,
});

const ACTIONS = ["document.upload", "document.view", "document.download", "document.update", "document.delete", "permission.grant", "permission.change", "permission.revoke", "admin.role_change", "admin.audit_view", "admin.users_view"];

function Audit() {
  const [action, setAction] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const f = {
    action: action === "all" ? undefined : action,
    outcome: outcome === "all" ? undefined : (outcome as "success" | "denied" | "failure"),
    from: from || undefined, to: to || undefined,
  };
  const { data, isLoading, error } = useQuery({ queryKey: ["audit", f], queryFn: () => listAuditLogs({ data: f }), retry: false });

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Every security-relevant event, newest first" />
      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 shadow-card sm:grid-cols-4">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger aria-label="Action"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All actions</SelectItem>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger aria-label="Outcome"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">{errMsg(error)}</p>
        : !data?.length ? <p className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">No audit events match these filters.</p>
        : (
          <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Details</th></tr>
              </thead>
              <tbody>
                {data.map((l) => (
                  <tr key={l.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3">{l.actorEmail}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                    <td className="px-4 py-3"><Badge variant={l.outcome === "success" ? "secondary" : "destructive"}>{l.outcome}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs">{l.document_id?.slice(0, 8) ?? "—"}</td>
                    <td className="max-w-xs break-all px-4 py-3 font-mono text-xs text-muted-foreground">{JSON.stringify(l.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
