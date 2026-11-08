/** Unique id. crypto.randomUUID needs HTTPS/localhost, so keep a fallback (e.g. testing on a phone over Wi-Fi). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
