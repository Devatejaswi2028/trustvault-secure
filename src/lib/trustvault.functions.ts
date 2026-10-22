import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateUpload, safeDisplayName, MAX_FILE_BYTES } from "@/lib/file-validation";
import { canRead, canEdit, canDelete, canManageSharing, type AccessFacts } from "@/lib/access";

const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60;

type Outcome = "success" | "denied" | "failure";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Trusted, server-side audit write. Never accepts input from the browser.
 * Throws if the write fails so callers never claim an event was audited when it wasn't.
 */
async function audit(entry: {
  actorId: string | null;
  documentId?: string | null;
  action: string;
  outcome: Outcome;
  details?: Record<string, unknown>;
}) {
  const db = await admin();
  const { error } = await db.from("audit_logs").insert({
    actor_id: entry.actorId,
    document_id: entry.documentId ?? null,
    action: entry.action,
    outcome: entry.outcome,
    details: (entry.details ?? {}) as never,
  });
  if (error) {
    console.error("AUDIT WRITE FAILED", entry.action, error.message);
    throw new Error("Audit logging failed; operation aborted");
  }
}

/** Generic denial — never reveals whether the document exists. */
class AccessDenied extends Error {
  constructor() {
    super("Document not found or access denied");
  }
}

/**
 * Loads authoritative access facts from the database for (document, current user).
 * Uses the service client only to read facts; the decision is made by the pure
 * functions in src/lib/access.ts which mirror the SQL RLS helpers.
 */
async function loadFacts(documentId: string, userId: string) {
  const db = await admin();
  const [{ data: doc }, { data: grant }, { data: roles }] = await Promise.all([
    db.from("documents").select("*").eq("id", documentId).maybeSingle(),
    db.from("document_permissions").select("permission").eq("document_id", documentId).eq("user_id", userId).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const facts: AccessFacts = {
    isOwner: !!doc && doc.owner_id === userId,
    grant: (grant?.permission as AccessFacts["grant"]) ?? null,
    isAdmin,
  };
  return { doc, facts };
}

async function getRoles(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

const uuid = z.string().uuid();

// ---------------------------------------------------------------- profile
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle();
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return {
      id: context.userId,
      email: profile?.email ?? (context.claims as { email?: string }).email ?? "",
      displayName: profile?.display_name ?? "",
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ displayName: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ display_name: data.displayName }).eq("id", context.userId);
    if (error) throw new Error("Could not update profile");
    return { ok: true };
  });

// ---------------------------------------------------------------- documents
const listSchema = z.object({
  scope: z.enum(["all", "mine", "shared"]).default("all"),
  q: z.string().max(200).optional(),
  owner: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["newest", "oldest", "name", "size"]).default("newest"),
});

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // RLS (can_read_document) limits rows to what this user may read.
    let q = context.supabase.from("documents").select("*");
    if (data.scope === "mine") q = q.eq("owner_id", context.userId);
    if (data.scope === "shared") q = q.neq("owner_id", context.userId);
    if (data.q) q = q.ilike("name", `%${data.q.replace(/[%_]/g, "")}%`);
    if (data.category) q = q.eq("category", data.category);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999Z`);
    const order =
      data.sort === "name" ? { col: "name", asc: true } :
      data.sort === "size" ? { col: "size_bytes", asc: false } :
      data.sort === "oldest" ? { col: "created_at", asc: true } : { col: "created_at", asc: false };
    q = q.order(order.col, { ascending: order.asc }).limit(500);
    const { data: docs, error } = await q;
    if (error) throw new Error("Could not load documents");

    // For shared scope, only documents explicitly granted (not admin oversight).
    let grants: Record<string, string> = {};
    const { data: myGrants } = await context.supabase.from("document_permissions").select("document_id, permission").eq("user_id", context.userId);
    grants = Object.fromEntries((myGrants ?? []).map((g) => [g.document_id, g.permission]));
    let rows = docs ?? [];
    if (data.scope === "shared") rows = rows.filter((d) => grants[d.id]);

    const ownerIds = [...new Set(rows.map((d) => d.owner_id))];
    const emails: Record<string, string> = {};
    if (ownerIds.length) {
      const db = await admin();
      const { data: profs } = await db.from("profiles").select("id, email").in("id", ownerIds);
      for (const p of profs ?? []) emails[p.id] = p.email;
    }
    let result = rows.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      sizeBytes: d.size_bytes,
      mimeType: d.mime_type,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      ownerId: d.owner_id,
      ownerEmail: emails[d.owner_id] ?? "unknown",
      isOwner: d.owner_id === context.userId,
      access: d.owner_id === context.userId ? "owner" : grants[d.id] ?? "admin",
    }));
    if (data.owner) {
      const o = data.owner.toLowerCase();
      result = result.filter((r) => r.ownerEmail.toLowerCase().includes(o));
    }
    return result;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ count: mine }, { data: grants }] = await Promise.all([
      sb.from("documents").select("id", { count: "exact", head: true }).eq("owner_id", context.userId),
      sb.from("document_permissions").select("document_id").eq("user_id", context.userId),
    ]);
    const { data: recent } = await sb
      .from("documents")
      .select("id, name, category, created_at, owner_id")
      .order("created_at", { ascending: false })
      .limit(6);
    const { data: myShares } = await sb
      .from("document_permissions")
      .select("id, documents!inner(owner_id)")
      .eq("documents.owner_id", context.userId);
    // Activity: user's own audit events, read via service client but filtered to the caller.
    const db = await admin();
    const { data: activity } = await db
      .from("audit_logs")
      .select("id, action, outcome, created_at, document_id")
      .eq("actor_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(8);
    return {
      counts: { mine: mine ?? 0, shared: grants?.length ?? 0, sharesGiven: myShares?.length ?? 0 },
      recent: (recent ?? []).map((r) => ({ ...r, isOwner: r.owner_id === context.userId })),
      activity: activity ?? [],
    };
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.id, context.userId);
    if (!doc || !canRead(facts)) {
      await audit({ actorId: context.userId, documentId: data.id, action: "document.view", outcome: "denied" });
      throw new AccessDenied();
    }
    const db = await admin();
    const { data: owner } = await db.from("profiles").select("email").eq("id", doc.owner_id).maybeSingle();
    return {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      description: doc.description,
      sizeBytes: doc.size_bytes,
      mimeType: doc.mime_type,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      ownerEmail: owner?.email ?? "unknown",
      can: { edit: canEdit(facts), delete: canDelete(facts), share: canManageSharing(facts) },
      access: facts.isOwner ? "owner" : facts.grant ?? "admin",
    };
  });

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data");
    return d;
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const roles = await getRoles(userId);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      await audit({ actorId: userId, action: "document.upload", outcome: "denied", details: { reason: "role" } });
      throw new Error("Your role does not allow uploading documents");
    }
    const file = data.get("file");
    const category = String(data.get("category") ?? "General").trim().slice(0, 60) || "General";
    const description = String(data.get("description") ?? "").trim().slice(0, 1000) || null;
    if (!(file instanceof File)) {
      await audit({ actorId: userId, action: "document.upload", outcome: "failure", details: { reason: "no file" } });
      throw new Error("No file provided");
    }
    if (file.size > MAX_FILE_BYTES) {
      await audit({ actorId: userId, action: "document.upload", outcome: "failure", details: { reason: "too large", size: file.size } });
      throw new Error("File exceeds the 10 MB limit");
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const v = validateUpload({ fileName: file.name, mime: file.type, size: buf.byteLength, head: buf.slice(0, 1024) });
    if (!v.ok) {
      await audit({ actorId: userId, action: "document.upload", outcome: "failure", details: { reason: v.reason } });
      throw new Error(v.reason);
    }
    const db = await admin();
    const id = crypto.randomUUID();
    // Server-generated path; the client file name never touches storage.
    const path = `${userId}/${id}.${v.ext}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, { contentType: v.mime, upsert: false });
    if (upErr) {
      await audit({ actorId: userId, action: "document.upload", outcome: "failure", details: { reason: "storage" } });
      throw new Error("Upload failed");
    }
    const { error: insErr } = await db.from("documents").insert({
      id,
      owner_id: userId,
      name: safeDisplayName(file.name),
      category,
      description,
      storage_path: path,
      mime_type: v.mime,
      size_bytes: buf.byteLength,
    });
    if (insErr) {
      // Compensate: remove orphaned object so storage and metadata stay consistent.
      await db.storage.from(BUCKET).remove([path]);
      await audit({ actorId: userId, action: "document.upload", outcome: "failure", details: { reason: "metadata" } });
      throw new Error("Upload failed");
    }
    try {
      await audit({ actorId: userId, documentId: id, action: "document.upload", outcome: "success", details: { size: buf.byteLength, mime: v.mime } });
    } catch (e) {
      await db.from("documents").delete().eq("id", id);
      await db.storage.from(BUCKET).remove([path]);
      throw e;
    }
    return { id };
  });

/**
 * ====================== DOWNLOAD AUTHORIZATION DECISION ======================
 * This is the single place where file content becomes reachable.
 * 1. requireSupabaseAuth verifies the bearer token (unauthenticated -> 401).
 * 2. loadFacts reads ownership + CURRENT grant from the database on every call.
 * 3. canRead() decides. If denied we audit and throw BEFORE creating any URL.
 * 4. Only then a 60-second signed URL is minted for the private bucket.
 *
 * If this check were removed, any signed-in user who learned or guessed a
 * document ID could download it (IDOR/BOLA), and revoked users would keep
 * access — the bucket has no user-facing storage policies, so this server
 * check is the only gate.
 * ===========================================================================
 */
export const downloadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.id, context.userId);
    if (!doc || !canRead(facts)) {
      await audit({ actorId: context.userId, documentId: data.id, action: "document.download", outcome: "denied" });
      throw new AccessDenied();
    }
    const db = await admin();
    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, { download: doc.name });
    if (error || !signed) {
      await audit({ actorId: context.userId, documentId: doc.id, action: "document.download", outcome: "failure" });
      throw new Error("Download unavailable");
    }
    await audit({ actorId: context.userId, documentId: doc.id, action: "document.download", outcome: "success", details: { via: facts.isOwner ? "owner" : facts.grant ?? "admin" } });
    return { url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: uuid,
      name: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(60),
      description: z.string().trim().max(1000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.id, context.userId);
    if (!doc || !canEdit(facts)) {
      await audit({ actorId: context.userId, documentId: data.id, action: "document.update", outcome: "denied" });
      throw new AccessDenied();
    }
    // Write as the user so RLS + column grants also enforce the rule.
    const { error } = await context.supabase
      .from("documents")
      .update({ name: safeDisplayName(data.name), category: data.category, description: data.description || null })
      .eq("id", data.id);
    if (error) {
      await audit({ actorId: context.userId, documentId: data.id, action: "document.update", outcome: "failure" });
      throw new Error("Update failed");
    }
    const changed = (["name", "category", "description"] as const).filter((k) => (doc[k] ?? null) !== (data[k] ?? null));
    await audit({ actorId: context.userId, documentId: data.id, action: "document.update", outcome: "success", details: { fields: changed } });
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.id, context.userId);
    if (!doc || !canDelete(facts)) {
      await audit({ actorId: context.userId, documentId: data.id, action: "document.delete", outcome: "denied" });
      throw new AccessDenied();
    }
    const db = await admin();
    const { error: sErr } = await db.storage.from(BUCKET).remove([doc.storage_path]);
    if (sErr) {
      await audit({ actorId: context.userId, documentId: doc.id, action: "document.delete", outcome: "failure" });
      throw new Error("Delete failed");
    }
    await db.from("documents").delete().eq("id", doc.id);
    await audit({ actorId: context.userId, documentId: doc.id, action: "document.delete", outcome: "success", details: { name: doc.name } });
    return { ok: true };
  });

// ---------------------------------------------------------------- sharing
export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const term = data.q.replace(/[%_,()]/g, "");
    const { data: rows } = await db
      .from("profiles")
      .select("id, email, display_name")
      .ilike("email", `${term}%`)
      .neq("id", context.userId)
      .limit(5);
    return (rows ?? []).map((r) => ({ id: r.id, email: r.email, displayName: r.display_name }));
  });

export const listPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.documentId, context.userId);
    if (!doc || !canManageSharing(facts)) throw new AccessDenied();
    const db = await admin();
    const { data: perms } = await db.from("document_permissions").select("id, user_id, permission, created_at, updated_at").eq("document_id", doc.id);
    const ids = (perms ?? []).map((p) => p.user_id);
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const em = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));
    return (perms ?? []).map((p) => ({ ...p, email: em[p.user_id] ?? "unknown" }));
  });

export const grantPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid, userId: uuid, permission: z.enum(["read", "edit"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.documentId, context.userId);
    if (!doc || !canManageSharing(facts)) {
      await audit({ actorId: context.userId, documentId: data.documentId, action: "permission.grant", outcome: "denied", details: { target: data.userId } });
      throw new AccessDenied();
    }
    if (data.userId === context.userId) throw new Error("You already own this document");
    const db = await admin();
    const { data: target } = await db.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (!target) throw new Error("User not found");
    const { data: existing } = await db.from("document_permissions").select("permission").eq("document_id", doc.id).eq("user_id", data.userId).maybeSingle();
    const { error } = await db.from("document_permissions").upsert(
      { document_id: doc.id, user_id: data.userId, permission: data.permission, granted_by: context.userId },
      { onConflict: "document_id,user_id" },
    );
    if (error) throw new Error("Could not update sharing");
    await audit({
      actorId: context.userId,
      documentId: doc.id,
      action: existing ? "permission.change" : "permission.grant",
      outcome: "success",
      details: { target: data.userId, permission: data.permission, previous: existing?.permission ?? null },
    });
    return { ok: true };
  });

export const revokePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid, userId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { doc, facts } = await loadFacts(data.documentId, context.userId);
    if (!doc || !canManageSharing(facts)) {
      await audit({ actorId: context.userId, documentId: data.documentId, action: "permission.revoke", outcome: "denied", details: { target: data.userId } });
      throw new AccessDenied();
    }
    const db = await admin();
    const { error } = await db.from("document_permissions").delete().eq("document_id", doc.id).eq("user_id", data.userId);
    if (error) throw new Error("Could not revoke access");
    await audit({ actorId: context.userId, documentId: doc.id, action: "permission.revoke", outcome: "success", details: { target: data.userId } });
    return { ok: true };
  });

// ---------------------------------------------------------------- admin
async function requireAdmin(context: { userId: string }, action: string) {
  const roles = await getRoles(context.userId);
  if (!roles.includes("admin")) {
    await audit({ actorId: context.userId, action, outcome: "denied" });
    throw new Error("Administrator access required");
  }
}

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      action: z.string().max(60).optional(),
      outcome: z.enum(["success", "denied", "failure"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context, "admin.audit_view");
    // Read as the user: RLS "admins read audit" independently enforces admin-only.
    let q = context.supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.action) q = q.eq("action", data.action);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999Z`);
    const { data: logs, error } = await q;
    if (error) throw new Error("Could not load audit logs");
    const ids = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
    const db = await admin();
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const em = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));
    return (logs ?? []).map((l) => ({ ...l, actorEmail: l.actor_id ? em[l.actor_id] ?? l.actor_id : "anonymous" }));
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context, "admin.users_view");
    const db = await admin();
    const { data: profs } = await db.from("profiles").select("id, email, display_name, created_at").order("created_at");
    const { data: roles } = await db.from("user_roles").select("user_id, role");
    return (profs ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string) }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: uuid, role: z.enum(["owner", "viewer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context, "admin.role_change");
    if (data.userId === context.userId) throw new Error("You cannot change your own role");
    const db = await admin();
    await db.from("user_roles").delete().eq("user_id", data.userId).in("role", ["owner", "viewer"]);
    const { error } = await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error("Could not change role");
    await audit({ actorId: context.userId, action: "admin.role_change", outcome: "success", details: { target: data.userId, role: data.role } });
    return { ok: true };
  });
