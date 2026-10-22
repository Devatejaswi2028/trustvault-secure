import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { DocumentList } from "@/components/document-list";

export const Route = createFileRoute("/_authenticated/shared")({
  head: () => ({ meta: [{ title: "Shared With Me — TrustVault" }, { name: "description", content: "Documents others shared with you." }] }),
  component: () => (
    <div>
      <PageHeader title="Shared With Me" subtitle="Documents others have given you access to" />
      <DocumentList scope="shared" emptyText="Nothing has been shared with you yet." />
    </div>
  ),
});
