import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { listDocuments, downloadDocument } from "@/lib/trustvault.functions";
import { CATEGORIES, errMsg, formatBytes, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export async function startDownload(id: string) {
  try {
    const { url } = await downloadDocument({ data: { id } });
    window.location.assign(url);
  } catch (e) {
    toast.error(errMsg(e));
  }
}

export function DocumentList({ scope, emptyText, emptyAction }: { scope: "mine" | "shared"; emptyText: string; emptyAction?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "size">("newest");
  const filters = { scope, q: q || undefined, owner: owner || undefined, category: category === "all" ? undefined : category, from: from || undefined, to: to || undefined, sort };
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", filters],
    queryFn: () => listDocuments({ data: filters }),
  });
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search by name" placeholder="Search by name" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {scope === "shared" && <Input aria-label="Filter by owner" placeholder="Owner email" value={owner} onChange={(e) => setOwner(e.target.value)} />}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="size">Largest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading documents…</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">{errMsg(error)}</div>
      ) : !data?.length ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{emptyText}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="hidden px-4 py-3 md:table-cell">Owner</th>
                <th className="hidden px-4 py-3 sm:table-cell">Size</th>
                <th className="hidden px-4 py-3 lg:table-cell">Uploaded</th>
                <th className="hidden px-4 py-3 lg:table-cell">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/documents/$id" params={{ id: d.id }} className="font-medium hover:text-primary hover:underline">{d.name}</Link>
                    {!d.isOwner && <Badge variant="secondary" className="ml-2">{d.access}</Badge>}
                  </td>
                  <td className="px-4 py-3">{d.category}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{d.isOwner ? "You" : d.ownerEmail}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell">{formatBytes(d.sizeBytes)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{formatDate(d.createdAt)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{formatDate(d.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" disabled={busy === d.id}
                      onClick={async () => { setBusy(d.id); await startDownload(d.id); setBusy(null); }}>
                      {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="sr-only sm:not-sr-only sm:ml-1">Download</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
