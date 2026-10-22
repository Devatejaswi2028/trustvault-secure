import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { FileText, LayoutDashboard, LogOut, Menu, ScrollText, Share2, ShieldCheck, Upload, User, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/trustvault.functions";
import { Badge } from "@/components/ui/badge";

export const meQuery = { queryKey: ["me"], queryFn: () => getMe() };

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "My Documents", icon: FileText },
  { to: "/shared", label: "Shared With Me", icon: Share2 },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/profile", label: "Profile", icon: User },
] as const;
const adminNav = [
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/users", label: "Users & Roles", icon: Users },
] as const;

export function roleLabel(roles: string[]) {
  if (roles.includes("admin")) return "Administrator";
  if (roles.includes("owner")) return "Document Owner";
  return "Viewer";
}

export function AppShell() {
  const { data: me } = useQuery(meQuery);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = me?.roles.includes("admin");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
      {isAdmin && (
        <>
          <div className="mt-4 px-3 pb-1 text-[11px] uppercase tracking-widest text-sidebar-primary">Administration</div>
          {adminNav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </>
      )}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground vault-grid">
      <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
        <ShieldCheck className="h-6 w-6 text-sidebar-primary" />
        <span className="font-display text-lg font-semibold">TrustVault</span>
      </Link>
      {links}
      <div className="mt-auto border-t border-sidebar-border pt-4">
        {me && (
          <div className="mb-3 px-2">
            <div className="truncate text-sm">{me.email}</div>
            <Badge variant="outline" className="mt-1 border-sidebar-primary/50 text-sidebar-primary">{roleLabel(me.roles)}</Badge>
          </div>
        )}
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen md:block">{sidebar}</aside>
      <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <span className="flex items-center gap-2 font-display font-semibold"><ShieldCheck className="h-5 w-5 text-sidebar-primary" /> TrustVault</span>
        <button aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
          <button aria-label="Close menu" className="absolute right-4 top-4 text-foreground" onClick={() => setOpen(false)}><X /></button>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
