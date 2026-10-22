import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { uploadDocument } from "@/lib/trustvault.functions";
import { ALLOWED_TYPES, MAX_FILE_BYTES } from "@/lib/file-validation";
import { CATEGORIES, errMsg, formatBytes } from "@/lib/format";
import { PageHeader, meQuery } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — TrustVault" }, { name: "description", content: "Upload a document to your vault." }] }),
  component: UploadPage,
});

function UploadPage() {
  const { data: me } = useQuery(meQuery);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canUpload = me && (me.roles.includes("owner") || me.roles.includes("admin"));

  function pick(f: File | null) {
    setError(null);
    setFile(f);
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_TYPES[ext]) setError("Unsupported file type. Allowed: PDF, JPG, PNG, TXT");
    else if (f.size > MAX_FILE_BYTES) setError("File exceeds the 10 MB limit");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || error) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("description", description);
    try {
      const { id } = await uploadDocument({ data: fd });
      toast.success("Document uploaded");
      qc.invalidateQueries();
      navigate({ to: "/documents/$id", params: { id } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  if (me && !canUpload) {
    return (
      <div>
        <PageHeader title="Upload Document" />
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">Your account has the Viewer role, which can't upload. Ask an administrator for the Document Owner role.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Upload Document" subtitle="PDF, JPG, PNG or TXT · up to 10 MB" />
      <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-6 shadow-card">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center hover:border-primary/60">
          <UploadCloud className="h-8 w-8 text-primary" />
          <span className="mt-2 text-sm">{file ? `${file.name} · ${formatBytes(file.size)}` : "Choose a file"}</span>
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description (optional)</Label>
          <Textarea id="desc" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={!file || !!error || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload securely
        </Button>
      </form>
    </div>
  );
}
