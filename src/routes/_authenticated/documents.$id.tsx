import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getDocument, updateDocument, deleteDocument, listPermissions, grantPermission, revokePermission, searchUsers,
} from "@/lib/trustvault.functions";
import { CATEGORIES, errMsg, formatBytes, formatDate } from "@/lib/format";
import { startDownload } from "@/components/document-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({ meta: [{ title: "Document — TrustVault" }, { name: "description", content: "Document details and sharing." }] }),
  component: DocumentPage,
});

type Confirm = { title: string; body: string; run: () => Promise<void> } | null;

function DocumentPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: doc, isLoading, error } = useQuery({ queryKey: ["doc", id], queryFn: () => getDocument({ data: { id } }), retry: false });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error || !doc)
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">{errMsg(error)}</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );

  return (
    <div className="max-w-4xl">
      <Link to="/documents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Documents</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="break-all text-2xl font-semibold">{doc.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Owned by {doc.access === "owner" ? "you" : doc.ownerEmail} · <Badge variant="secondary">{doc.access}</Badge></p>
        </div>
        <div className="flex gap-2">
          <Button disabled={downloading} onClick={async () => { setDownloading(true); await startDownload(doc.id); setDownloading(false); }}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download
          </Button>
          {doc.can.delete && (
            <Button variant="destructive" onClick={() => setConfirm({
              title: "Delete this document?",
              body: "The file and all sharing permissions will be permanently removed.",
              run: async () => {
                await deleteDocument({ data: { id: doc.id } });
                toast.success("Document deleted");
                qc.invalidateQueries();
                navigate({ to: "/documents" });
              },
            })}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          )}
        </div>
      </div>

      <dl className="grid gap-4 rounded-lg border bg-card p-5 shadow-card sm:grid-cols-4">
        <Meta label="Category" value={doc.category} />
        <Meta label="Size" value={formatBytes(doc.sizeBytes)} />
        <Meta label="Uploaded" value={formatDate(doc.createdAt)} />
        <Meta label="Last updated" value={formatDate(doc.updatedAt)} />
      </dl>

      {doc.can.edit ? <EditForm doc={doc} /> : doc.description && <p className="mt-6 text-sm text-muted-foreground">{doc.description}</p>}
      {doc.can.share && <Sharing documentId={doc.id} setConfirm={setConfirm} />}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const c = confirm; setConfirm(null);
              try { await c?.run(); } catch (e) { toast.error(errMsg(e)); }
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}

function EditForm({ doc }: { doc: { id: string; name: string; category: string; description: string | null } }) {
  const qc = useQueryClient();
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [description, setDescription] = useState(doc.description ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <form className="mt-6 space-y-4 rounded-lg border bg-card p-5 shadow-card" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return toast.error("Name is required");
      setSaving(true);
      try {
        await updateDocument({ data: { id: doc.id, name, category, description } });
        toast.success("Details saved");
        qc.invalidateQueries();
      } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
    }}>
      <h2 className="font-semibold">Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="n">Name</Label><Input id="n" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([...CATEGORIES, doc.category])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="d">Description</Label><Textarea id="d" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button>
    </form>
  );
}

function Sharing({ documentId, setConfirm }: { documentId: string; setConfirm: (c: Confirm) => void }) {
  const qc = useQueryClient();
  const key = ["perms", documentId];
  const { data: perms, isLoading } = useQuery({ queryKey: key, queryFn: () => listPermissions({ data: { documentId } }) });
  const [q, setQ] = useState("");
  const [perm, setPerm] = useState<"read" | "edit">("read");
  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", q],
    queryFn: () => searchUsers({ data: { q } }),
    enabled: q.trim().length >= 3,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <section className="mt-6 rounded-lg border bg-card p-5 shadow-card">
      <h2 className="font-semibold">Sharing &amp; permissions</h2>
      <p className="mt-1 text-sm text-muted-foreground">Read lets people view and download. Edit also lets them change details. Only you can delete or share.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search people by email (3+ characters)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <Select value={perm} onValueChange={(v) => setPerm(v as "read" | "edit")}>
          <SelectTrigger className="sm:w-32" aria-label="Permission"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="read">Read</SelectItem><SelectItem value="edit">Edit</SelectItem></SelectContent>
        </Select>
      </div>
      {q.trim().length >= 3 && (
        <ul className="mt-2 rounded-md border">
          {isFetching ? <li className="p-3 text-sm text-muted-foreground">Searching…</li> :
            !results?.length ? <li className="p-3 text-sm text-muted-foreground">No matching users</li> :
            results.map((u) => (
              <li key={u.id} className="flex items-center justify-between border-b p-3 text-sm last:border-0">
                <span>{u.email}</span>
                <Button size="sm" onClick={() => setConfirm({
                  title: `Grant ${perm} access?`,
                  body: `${u.email} will be able to ${perm === "edit" ? "view, download and edit details of" : "view and download"} this document.`,
                  run: async () => {
                    await grantPermission({ data: { documentId, userId: u.id, permission: perm } });
                    toast.success("Access granted");
                    setQ("");
                    refresh();
                  },
                })}>Share</Button>
              </li>
            ))}
        </ul>
      )}
      <h3 className="mt-6 text-sm font-medium">People with access</h3>
      {isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading…</p> : !perms?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">Only you can access this document.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-md border">
          {perms.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{p.email}</span>
              <div className="flex items-center gap-2">
                <Select value={p.permission} onValueChange={(v) => setConfirm({
                  title: `Change access to ${v}?`,
                  body: `${p.email} will have ${v} access.`,
                  run: async () => {
                    await grantPermission({ data: { documentId, userId: p.user_id, permission: v as "read" | "edit" } });
                    toast.success("Permission updated");
                    refresh();
                  },
                })}>
                  <SelectTrigger className="h-8 w-24" aria-label={`Permission for ${p.email}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="read">Read</SelectItem><SelectItem value="edit">Edit</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setConfirm({
                  title: "Revoke access?",
                  body: `${p.email} will immediately lose access, including downloads.`,
                  run: async () => {
                    await revokePermission({ data: { documentId, userId: p.user_id } });
                    toast.success("Access revoked");
                    refresh();
                  },
                })}>Revoke</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
