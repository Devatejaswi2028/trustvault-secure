// Pure, server-reusable upload validation. Runs on the server in uploadDocument;
// the browser runs the same checks only for faster feedback.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, { mimes: string[]; canonical: string }> = {
  pdf: { mimes: ["application/pdf"], canonical: "application/pdf" },
  jpg: { mimes: ["image/jpeg"], canonical: "image/jpeg" },
  jpeg: { mimes: ["image/jpeg"], canonical: "image/jpeg" },
  png: { mimes: ["image/png"], canonical: "image/png" },
  txt: { mimes: ["text/plain"], canonical: "text/plain" },
};

export type ValidationResult =
  | { ok: true; ext: string; mime: string }
  | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, sig: number[]) {
  return sig.every((b, i) => bytes[i] === b);
}

/** Check the file's real content matches its claimed type. */
export function sniffMatches(ext: string, head: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "txt":
      // Reject binary content: no NUL bytes in the sampled head.
      return !head.includes(0);
    default:
      return false;
  }
}

export function validateUpload(input: {
  fileName: string;
  mime: string;
  size: number;
  head: Uint8Array;
}): ValidationResult {
  const name = input.fileName.trim();
  if (!name || name.length > 200) return { ok: false, reason: "Invalid file name" };
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "File must have an extension" };
  const ext = name.slice(dot + 1).toLowerCase();
  const rule = ALLOWED_TYPES[ext];
  if (!rule) return { ok: false, reason: "Unsupported file type. Allowed: PDF, JPG, PNG, TXT" };
  if (input.size <= 0) return { ok: false, reason: "File is empty" };
  if (input.size > MAX_FILE_BYTES) return { ok: false, reason: "File exceeds the 10 MB limit" };
  const mime = ((input.mime || "").split(";")[0] ?? "").trim().toLowerCase();
  if (!rule.mimes.includes(mime)) return { ok: false, reason: "File type does not match its extension" };
  if (!sniffMatches(ext, input.head)) return { ok: false, reason: "File content does not match its type" };
  return { ok: true, ext, mime: rule.canonical };
}

/** Sanitised display name; never used as a storage path. */
export function safeDisplayName(name: string) {
  return name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 200);
}
