import { clearAllData, openDb, STORE } from "../database/db";
import { listThreads } from "../database/chats";
import { listCourses } from "../database/courses";
import type { Profile } from "../types/settings";
import { getProfile } from "./settingsService";
import { validateCourse, validateThread } from "./validate";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const EXAM_KEY = "ai-academy:exam-results:v1";
const GAME_KEY = "ai-academy:game-results:v1";

function readLocalArray(key: string): unknown[] {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.slice(0, 20) : []; }
  catch { return []; }
}

function validateResults(value: unknown, kind: "exam" | "game"): Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error("سوابق آزمون یا بازی در فایل پشتیبان نامعتبر است.");
  return value.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("سابقه " + (i + 1) + " نامعتبر است.");
    const x = item as Record<string, unknown>;
    const base = typeof x.id === "string" && x.id.length > 0 && x.id.length <= 100 && typeof x.date === "number" && Number.isFinite(x.date) && x.date >= 0;
    const valid = kind === "exam"
      ? base && Number.isInteger(x.correct) && Number.isInteger(x.total) && (x.correct as number) >= 0 && (x.total as number) > 0 && (x.correct as number) <= (x.total as number) && x.percent === Math.round((x.correct as number) / (x.total as number) * 100)
      : base && Number.isInteger(x.points) && Number.isInteger(x.correct) && Number.isInteger(x.answered) && Number.isInteger(x.bestStreak) && (x.points as number) >= 0 && (x.correct as number) >= 0 && (x.answered as number) > 0 && (x.correct as number) <= (x.answered as number) && (x.bestStreak as number) >= 0 && (x.bestStreak as number) <= (x.answered as number) && x.points === (x.correct as number) * 10;
    if (!valid) throw new Error("ساختار سابقه " + (i + 1) + " معتبر نیست.");
    return x;
  });
}

/** The access token and any API key are deliberately NOT exported. */
export async function exportData(): Promise<string> {
  const [courses, chats, profile] = await Promise.all([listCourses(), listThreads(), getProfile()]);
  const examResults = readLocalArray(EXAM_KEY);
  const gameResults = readLocalArray(GAME_KEY);
  return JSON.stringify({ app: "ai-academy", version: 1, exportedAt: Date.now(), profile, courses, chats, examResults, gameResults }, null, 2);
}

/** Validate the entire backup before writing; all imported stores commit in one transaction. */
export async function importData(text: string): Promise<{ courses: number; chats: number; exams: number; games: number }> {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error("فایل بیش از حد بزرگ است.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("فایل JSON معتبر نیست."); }
  if (!raw || typeof raw !== "object" || (raw as any).app !== "ai-academy") throw new Error("این فایل خروجی آکادمی هوش مصنوعی نیست.");
  if ((raw as any).version !== 1) throw new Error("نسخه این فایل پشتیبانی نمی‌شود.");
  const r = raw as { courses?: unknown; chats?: unknown; profile?: unknown; examResults?: unknown; gameResults?: unknown };
  const rawCourses = Array.isArray(r.courses) ? r.courses : [];
  const rawChats = Array.isArray(r.chats) ? r.chats : [];
  if (rawCourses.length > 500 || rawChats.length > 2000) throw new Error("تعداد داده‌ها بیش از حد مجاز است.");
  const courses = rawCourses.map((c, i) => validateCourse(c, i));
  const chats = rawChats.map((c, i) => validateThread(c, i));
  const courseIds = new Set<string>();
  for (const course of courses) {
    if (courseIds.has(course.id)) throw new Error("فایل پشتیبان شامل شناسه دوره تکراری است.");
    courseIds.add(course.id);
  }
  const chatIds = new Set<string>();
  for (const chat of chats) {
    if (chatIds.has(chat.id)) throw new Error("فایل پشتیبان شامل شناسه گفتگوی تکراری است.");
    chatIds.add(chat.id);
  }
  const examResults = r.examResults === undefined ? readLocalArray(EXAM_KEY) : validateResults(r.examResults, "exam");
  const gameResults = r.gameResults === undefined ? readLocalArray(GAME_KEY) : validateResults(r.gameResults, "game");
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

  const previousExam = localStorage.getItem(EXAM_KEY);
  const previousGame = localStorage.getItem(GAME_KEY);
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
  try {
    localStorage.setItem(EXAM_KEY, JSON.stringify(examResults));
    localStorage.setItem(GAME_KEY, JSON.stringify(gameResults));
  } catch {
    try {
      if (previousExam === null) localStorage.removeItem(EXAM_KEY); else localStorage.setItem(EXAM_KEY, previousExam);
      if (previousGame === null) localStorage.removeItem(GAME_KEY); else localStorage.setItem(GAME_KEY, previousGame);
    } catch { /* best effort */ }
    throw new Error("دوره‌ها و گفتگوها وارد شدند، اما ذخیره سوابق آزمون و بازی ممکن نشد. فضای ذخیره‌سازی را بررسی کنید.");
  }
  return { courses: courses.length, chats: chats.length, exams: examResults.length, games: gameResults.length };
}

/** Remove IndexedDB data and result histories stored separately in localStorage. */
export async function deleteAllData(): Promise<void> {
  await clearAllData();
  localStorage.removeItem(EXAM_KEY);
  localStorage.removeItem(GAME_KEY);
}
