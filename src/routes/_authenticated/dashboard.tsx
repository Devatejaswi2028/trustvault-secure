import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Share2, Upload, Users } from "lucide-react";
import { getDashboard } from "@/lib/trustvault.functions";
import { errMsg, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TrustVault" }, { name: "description", content: "Your TrustVault overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error || !data) return <p className="text-destructive">{errMsg(error)}</p>;
  const stats = [
    { label: "My documents", value: data.counts.mine, icon: FileText, to: "/documents" as const },
    { label: "Shared with me", value: data.counts.shared, icon: Share2, to: "/shared" as const },
    { label: "Active shares I gave", value: data.counts.sharesGiven, icon: Users, to: "/documents" as const },
  ];
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your vault" action={<Button asChild><Link to="/upload"><Upload className="mr-2 h-4 w-4" />Upload</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="rounded-lg border bg-card p-5 shadow-card hover:border-primary/50">
            <s.icon className="h-5 w-5 text-primary" />
            <div className="mt-3 font-display text-3xl font-semibold">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-semibold">Recent documents</h2>
          {data.recent.length === 0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : (
            <ul className="divide-y">
              {data.recent.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to="/documents/$id" params={{ id: d.id }} className="truncate hover:text-primary">{d.name}</Link>
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">{d.isOwner ? d.category : "Shared"} · {formatDate(d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-semibold">My recent activity</h2>
          {data.activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
            <ul className="divide-y">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={a.outcome === "success" ? "secondary" : "destructive"}>{a.outcome}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
