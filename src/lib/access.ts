// Pure permission model, mirrored exactly by the SQL functions
// public.can_read_document / public.can_edit_document / public.is_document_owner.
export type DocPermission = "read" | "edit";

export interface AccessFacts {
  isOwner: boolean;
  grant: DocPermission | null;
  isAdmin: boolean;
}

export const canRead = (f: AccessFacts) => f.isOwner || f.grant === "read" || f.grant === "edit" || f.isAdmin;
// Editors may change metadata; admins get read-only oversight, not edit rights.
export const canEdit = (f: AccessFacts) => f.isOwner || f.grant === "edit";
// Only owners delete or manage sharing.
export const canDelete = (f: AccessFacts) => f.isOwner;
export const canManageSharing = (f: AccessFacts) => f.isOwner;
