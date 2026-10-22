import { createFileRoute, Link } from "@tanstack/react-router";
import { FileLock2, History, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustVault — Secure Document Sharing" },
      { name: "description", content: "Share documents with read or edit permissions, short-lived secure downloads and a tamper-proof audit trail." },
      { property: "og:title", content: "TrustVault — Secure Document Sharing" },
      { property: "og:description", content: "Precise permissions, secure downloads and a full audit trail for your documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: KeyRound, title: "Precise permissions", text: "Grant read or edit access per person. Revoke instantly." },
  { icon: FileLock2, title: "Private storage", text: "Files never sit on a public link. Every download is checked and expires in 60 seconds." },
  { icon: History, title: "Full audit trail", text: "Every upload, download, denial and permission change is recorded." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-ink text-ink-foreground vault-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-lg font-semibold"><ShieldCheck className="h-6 w-6 text-brass" /> TrustVault</span>
        <Button asChild variant="secondary" size="sm"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Secure document sharing</p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Your documents, shared with exactly the right people.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-foreground/70">
          Upload, share and revoke with confidence. Every access is verified on the server and written to the audit log.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth">Open your vault</Link></Button>
        </div>
        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-6">
              <f.icon className="h-6 w-6 text-brass" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-foreground/70">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
