import { listCourses, saveCourse } from "../database/courses";
import { listThreads, saveThread } from "../database/chats";
import { accountApi } from "./accountService";
import type { Course } from "../types/course";
import type { ChatThread } from "../types/chat";
import { validateCourse, validateThread } from "./validate";

interface CloudRecord<T> { id: string; payload: T; updated_at: number }
let syncInProgress = false;
let activeSync: Promise<{ courses: number; chats: number }> | null = null;
export function isAccountSyncInProgress(): boolean { return syncInProgress; }

function mergeByUpdatedAt<T extends { id: string; updatedAt: number }>(
  local: T[], remote: CloudRecord<T>[], validate: (value: unknown, index: number) => T
): T[] {
  const merged = new Map<string, T>();
  remote.forEach((record, index) => {
    if (!record || typeof record.id !== "string" || !record.payload || record.payload.id !== record.id) return;
    try {
      const payload = validate(record.payload, index);
      const previous = merged.get(payload.id);
      if (!previous || payload.updatedAt > previous.updatedAt) merged.set(payload.id, payload);
    } catch { /* Ignore invalid cloud rows; they must not corrupt local data. */ }
  });
  for (const item of local) {
    const cloud = merged.get(item.id);
    if (!cloud || item.updatedAt >= cloud.updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()];
}

/** Merge local and cloud copies by last update, then persist the merged snapshot in both places. */
export function syncAccountData(): Promise<{ courses: number; chats: number }> {
  // Share one in-flight operation across UI actions, reconnect events and data-change listeners.
  // Callers await the real result instead of receiving a misleading { courses: 0, chats: 0 }.
  if (activeSync) return activeSync;

  syncInProgress = true;
  activeSync = (async () => {
    const [localCourses, localChats, cloudCourses, cloudChats] = await Promise.all([
      listCourses(), listThreads(),
      accountApi<{ records: CloudRecord<Course>[] }>("/api/sync/courses", "GET"),
      accountApi<{ records: CloudRecord<ChatThread>[] }>("/api/sync/chats", "GET")
    ]);
    const courses = mergeByUpdatedAt(localCourses, cloudCourses.records ?? [], validateCourse);
    const chats = mergeByUpdatedAt(localChats, cloudChats.records ?? [], validateThread);

    for (const course of courses) await saveCourse(course);
    for (const thread of chats) await saveThread(thread);

    await accountApi("/api/sync/courses", "PUT", { records: courses.map(payload => ({ id: payload.id, payload })) });
    await accountApi("/api/sync/chats", "PUT", { records: chats.map(payload => ({ id: payload.id, payload })) });
    return { courses: courses.length, chats: chats.length };
  })().finally(() => {
    syncInProgress = false;
    activeSync = null;
  });

  return activeSync;
}
