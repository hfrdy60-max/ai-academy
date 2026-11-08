/** Persian message for the user. Raw browser errors are English, so show a generic one for them. */
export function errMsg(e: unknown): string {
  if (e instanceof Error && /[\u0600-\u06FF]/.test(e.message)) return e.message;
  return "خطایی در ذخیره‌سازی محلی رخ داد. دوباره تلاش کنید.";
}
