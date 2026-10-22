export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
export function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
export const CATEGORIES = ["General", "Finance", "Legal", "HR", "Engineering", "Personal"];
