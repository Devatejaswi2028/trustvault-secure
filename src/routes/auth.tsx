import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — TrustVault" },
      { name: "description", content: "Sign in or create your TrustVault account." },
      { property: "og:title", content: "Sign in — TrustVault" },
      { property: "og:description", content: "Access your secure document vault." },
    ],
  }),
  component: AuthPage,
});

const credsSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function safeRedirect(r?: string) {
  return r && r.startsWith("/") && !r.startsWith("//") ? r : "/dashboard";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const target = safeRedirect(redirect);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target, replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: target, replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "forgot") {
      const r = z.string().email().safeParse(email.trim());
      if (!r.success) return setError("Enter a valid email");
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setLoading(false);
      if (error) return setError(error.message);
      return setNotice("If an account exists, a reset link has been sent.");
    }
    const parsed = credsSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid input");
    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
      setLoading(false);
      if (error) return setError(error.message);
      if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setLoading(false);
      if (error) return setError(error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message);
    }
  }

  async function social(provider: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground vault-grid md:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold"><ShieldCheck className="h-6 w-6 text-brass" /> TrustVault</Link>
        <div>
          <h2 className="text-3xl font-semibold">Every access verified.<br />Every action recorded.</h2>
          <p className="mt-4 max-w-sm text-ink-foreground/70">Your files stay private until you decide who can see them.</p>
        </div>
        <p className="font-mono text-xs text-ink-foreground/50">Signed URLs expire in 60 seconds.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>}
                </div>
                <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          {mode !== "forgot" && (
            <div className="mt-6 space-y-3">
              <div className="text-center text-xs text-muted-foreground">or</div>
              <Button variant="outline" className="w-full" onClick={() => social("google")}>Continue with Google</Button>
              <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>Continue with Lovable</button>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>No account? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Create one</button></>
            ) : (
              <>Have an account? <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
