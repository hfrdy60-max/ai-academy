import { clearAllData, openDb, STORE } from "../database/db";
import { listThreads } from "../database/chats";
import { listCourses } from "../database/courses";
import type { Profile } from "../types/settings";
import { getProfile } from "./settingsService";
import { validateCourse, validateThread } from "./validate";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** The access token and any API key are deliberately NOT exported. */
export async function exportData(): Promise<string> {
  const [courses, chats, profile] = await Promise.all([listCourses(), listThreads(), getProfile()]);
  return JSON.stringify({ app: "ai-academy", version: 1, exportedAt: Date.now(), profile, courses, chats }, null, 2);
}

/** Validate the entire backup before writing; all imported stores commit in one transaction. */
export async function importData(text: string): Promise<{ courses: number; chats: number }> {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error("فایل بیش از حد بزرگ است.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("فایل JSON معتبر نیست."); }
  if (!raw || typeof raw !== "object" || (raw as any).app !== "ai-academy") throw new Error("این فایل خروجی آکادمی هوش مصنوعی نیست.");
  if ((raw as any).version !== 1) throw new Error("نسخه این فایل پشتیبانی نمی‌شود.");
  const r = raw as { courses?: unknown; chats?: unknown; profile?: unknown };
  const rawCourses = Array.isArray(r.courses) ? r.courses : [];
  const rawChats = Array.isArray(r.chats) ? r.chats : [];
  if (rawCourses.length > 500 || rawChats.length > 2000) throw new Error("تعداد داده‌ها بیش از حد مجاز است.");
  const courses = rawCourses.map((c, i) => validateCourse(c, i));
  const chats = rawChats.map((c, i) => validateThread(c, i));
  let profile: Profile | undefined;
  if (r.profile !== undefined) {
    if (!r.profile || typeof r.profile !== "object" || Array.isArray(r.profile)) throw new Error("پروفایل فایل پشتیبان نامعتبر است.");
    const p = r.profile as Record<string, unknown>;
    const displayName = p.displayName;
    const dailyGoal = p.dailyGoal;
    if (typeof displayName !== "string" || displayName.length > 40 ||
        typeof dailyGoal !== "number" || !Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 10) {
      throw new Error("اطلاعات پروفایل فایل پشتیبان معتبر نیست.");
    }
    profile = { displayName: displayName.trim(), dailyGoal };
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE.courses, STORE.chats, STORE.settings], "readwrite");
    for (const course of courses) tx.objectStore(STORE.courses).put(course);
    for (const chat of chats) tx.objectStore(STORE.chats).put(chat);
    if (profile) tx.objectStore(STORE.settings).put({ key: "profile", value: profile });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("وارد کردن فایل پشتیبان ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("وارد کردن فایل پشتیبان لغو شد؛ هیچ تغییری ذخیره نشد."));
  });
  return { courses: courses.length, chats: chats.length };
}

export const deleteAllData = (): Promise<void> => clearAllData();
