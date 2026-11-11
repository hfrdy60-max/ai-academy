import { getSetting, setSetting } from "../database/settings";
import type { AiSettings, Profile } from "../types/settings";

const KEY = { profile: "profile", ai: "ai", usage: "usage" } as const;

/** Accept https URLs, or http only for localhost (so the access token is never sent in clear text over the internet). */
export function normalizeWorkerUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  let u: URL;
  try { u = new URL(s); } catch { throw new Error("آدرس سرور معتبر نیست. نمونه: https://ai-academy-api.xxx.workers.dev"); }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new Error("آدرس سرور باید با https شروع شود.");
  if (u.username || u.password) throw new Error("آدرس سرور نباید شامل نام کاربری یا رمز باشد.");
  return (u.origin + u.pathname).replace(/\/+$/, "");
}

export async function getProfile(): Promise<Profile> {
  const p = await getSetting<Partial<Profile>>(KEY.profile);
  const goal = Number(p?.dailyGoal);
  return {
    displayName: typeof p?.displayName === "string" ? p.displayName.slice(0, 40) : "",
    dailyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 10 ? goal : 1
  };
}

export async function saveProfile(p: Profile): Promise<Profile> {
  const goal = Math.round(Number(p.dailyGoal));
  if (!Number.isFinite(goal) || goal < 1 || goal > 10) throw new Error("هدف روزانه باید بین ۱ تا ۱۰ درس باشد.");
  const clean: Profile = { displayName: p.displayName.trim().slice(0, 40), dailyGoal: goal };
  await setSetting(KEY.profile, clean);
  return clean;
}

const envUrl = (): string => {
  const v = import.meta.env?.VITE_WORKER_URL; // public Worker address only, never a key
  return typeof v === "string" && v ? v : "https://ai-academy-api.hfrdy60.workers.dev";
};

export async function getAiSettings(): Promise<AiSettings> {
  const s = await getSetting<Partial<AiSettings>>(KEY.ai);
  return { workerUrl: s?.workerUrl || envUrl(), accessToken: s?.accessToken ?? "" };
}

export async function saveAiSettings(s: AiSettings): Promise<AiSettings> {
  const token = s.accessToken.trim();
  if (token.length > 200) throw new Error("توکن دسترسی خیلی طولانی است.");
  const clean: AiSettings = { workerUrl: normalizeWorkerUrl(s.workerUrl), accessToken: token };
  await setSetting(KEY.ai, clean);
  return clean;
}

export async function getUsage(): Promise<number> {
  const n = await getSetting<number>(KEY.usage);
  return typeof n === "number" && n >= 0 ? n : 0;
}

export async function addUsage(tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  await setSetting(KEY.usage, (await getUsage()) + Math.round(tokens));
}
