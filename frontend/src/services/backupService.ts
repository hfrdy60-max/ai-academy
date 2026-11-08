import { clearAllData } from "../database/db";
import { listThreads, saveThread } from "../database/chats";
import { listCourses, saveCourse } from "../database/courses";
import type { Profile } from "../types/settings";
import { getProfile, saveProfile } from "./settingsService";
import { validateCourse, validateThread } from "./validate";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** The access token and any API key are deliberately NOT exported. */
export async function exportData(): Promise<string> {
  const [courses, chats, profile] = await Promise.all([listCourses(), listThreads(), getProfile()]);
  return JSON.stringify({ app: "ai-academy", version: 1, exportedAt: Date.now(), profile, courses, chats }, null, 2);
}

/** Validates the whole file first; nothing is written unless everything is valid. Same ids are overwritten. */
export async function importData(text: string): Promise<{ courses: number; chats: number }> {
  if (text.length > MAX_IMPORT_BYTES) throw new Error("فایل بیش از حد بزرگ است.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("فایل JSON معتبر نیست."); }
  if (!raw || typeof raw !== "object" || (raw as any).app !== "ai-academy") throw new Error("این فایل خروجی آکادمی هوش مصنوعی نیست.");
  if ((raw as any).version !== 1) throw new Error("نسخه این فایل پشتیبانی نمی‌شود.");
  const r = raw as { courses?: unknown; chats?: unknown; profile?: Partial<Profile> };
  const rawCourses = Array.isArray(r.courses) ? r.courses : [];
  const rawChats = Array.isArray(r.chats) ? r.chats : [];
  if (rawCourses.length > 500 || rawChats.length > 2000) throw new Error("تعداد داده‌ها بیش از حد مجاز است.");
  const courses = rawCourses.map((c, i) => validateCourse(c, i));
  const chats = rawChats.map((c, i) => validateThread(c, i));
  for (const c of courses) await saveCourse(c);
  for (const t of chats) await saveThread(t);
  if (r.profile && typeof r.profile.displayName === "string") await saveProfile({ displayName: r.profile.displayName, dailyGoal: Number(r.profile.dailyGoal) || 1 }).catch(() => {});
  return { courses: courses.length, chats: chats.length };
}

export const deleteAllData = (): Promise<void> => clearAllData();
