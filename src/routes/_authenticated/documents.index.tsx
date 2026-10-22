import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { DocumentList } from "@/components/document-list";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({ meta: [{ title: "My Documents — TrustVault" }, { name: "description", content: "Documents you own." }] }),
  component: () => (
    <div>
      <PageHeader title="My Documents" subtitle="Documents you own" action={<Button asChild><Link to="/upload">Upload</Link></Button>} />
      <DocumentList scope="mine" emptyText="You haven't uploaded any documents yet." emptyAction={<Button asChild><Link to="/upload">Upload your first document</Link></Button>} />
    </div>
  ),
});
