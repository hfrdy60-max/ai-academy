import { listCourses, saveCourse } from "../database/courses";
import { listThreads, saveThread } from "../database/chats";
import { accountApi } from "./accountService";
import type { Course } from "../types/course";
import type { ChatThread } from "../types/chat";

interface CloudRecord<T> { id: string; payload: T; updated_at: number }
let syncInProgress = false;
export function isAccountSyncInProgress(): boolean { return syncInProgress; }

function mergeByUpdatedAt<T extends { id: string; updatedAt: number }>(local: T[], remote: CloudRecord<T>[]): T[] {
  const merged = new Map<string, T>();
  for (const item of remote) {
    if (item?.payload && typeof item.id === "string" && item.payload.id === item.id) merged.set(item.id, item.payload);
  }
  for (const item of local) {
    const cloud = merged.get(item.id);
    if (!cloud || item.updatedAt >= cloud.updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()];
}

/** Merge local and cloud copies by last update, then persist the merged snapshot in both places. */
export async function syncAccountData(): Promise<{ courses: number; chats: number }> {
  if (syncInProgress) return { courses: 0, chats: 0 };
  syncInProgress = true;
  try {
  const [localCourses, localChats, cloudCourses, cloudChats] = await Promise.all([
    listCourses(), listThreads(),
    accountApi<{ records: CloudRecord<Course>[] }>("/api/sync/courses", "GET"),
    accountApi<{ records: CloudRecord<ChatThread>[] }>("/api/sync/chats", "GET")
  ]);
  const courses = mergeByUpdatedAt(localCourses, cloudCourses.records ?? []);
  const chats = mergeByUpdatedAt(localChats, cloudChats.records ?? []);
  for (const course of courses) await saveCourse(course);
  for (const thread of chats) await saveThread(thread);
  await accountApi("/api/sync/courses", "PUT", { records: courses.map(payload => ({ id: payload.id, payload })) });
  await accountApi("/api/sync/chats", "PUT", { records: chats.map(payload => ({ id: payload.id, payload })) });
  return { courses: courses.length, chats: chats.length };
  } finally { syncInProgress = false; }
}
