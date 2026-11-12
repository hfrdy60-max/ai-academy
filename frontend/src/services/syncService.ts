import { listCourses, saveCourse, purgeCourse } from "../database/courses";
import { listThreads, saveThread, purgeThread } from "../database/chats";
import { accountApi } from "./accountService";
import type { Course } from "../types/course";
import type { ChatThread } from "../types/chat";
import { validateCourse, validateThread } from "./validate";
import { deleteTombstone, listTombstones, saveTombstone, tombstoneId, type SyncTombstone } from "../database/tombstones";

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

/** Merge local/cloud records while honoring deletion markers from every signed-in device. */
export function syncAccountData(): Promise<{ courses: number; chats: number }> {
  if (activeSync) return activeSync;

  syncInProgress = true;
  activeSync = (async () => {
    const [localCourses, localChats, localTombstones, cloudCourses, cloudChats, cloudDeletions] = await Promise.all([
      listCourses(), listThreads(), listTombstones(),
      accountApi<{ records: CloudRecord<Course>[] }>("/api/sync/courses", "GET"),
      accountApi<{ records: CloudRecord<ChatThread>[] }>("/api/sync/chats", "GET"),
      accountApi<{ deletions: { record_type: "course" | "chat"; record_id: string; deleted_at: number }[] }>("/api/sync/deletions", "GET")
    ]);

    const tombstones = new Map<string, SyncTombstone>();
    for (const row of localTombstones) tombstones.set(row.id, row);
    for (const row of cloudDeletions.deletions ?? []) {
      if ((row.record_type !== "course" && row.record_type !== "chat") ||
          typeof row.record_id !== "string" || !Number.isSafeInteger(row.deleted_at) || row.deleted_at < 0) continue;
      const id = tombstoneId(row.record_type, row.record_id);
      const previous = tombstones.get(id);
      if (!previous || row.deleted_at > previous.deletedAt) {
        tombstones.set(id, { id, type: row.record_type, recordId: row.record_id, deletedAt: row.deleted_at });
      }
    }

    const courses = mergeByUpdatedAt(localCourses, cloudCourses.records ?? [], validateCourse);
    const chats = mergeByUpdatedAt(localChats, cloudChats.records ?? [], validateThread);

    const keepOrRemove = async <T extends { id: string; updatedAt: number }>(
      items: T[], type: "course" | "chat"
    ): Promise<T[]> => {
      const kept: T[] = [];
      for (const item of items) {
        const id = tombstoneId(type, item.id);
        const deletion = tombstones.get(id);
        if (!deletion) { kept.push(item); continue; }
        if (deletion.deletedAt >= item.updatedAt) {
          // Remove stale local copies too; filtering the upload alone would leave them visible offline.
          if (type === "course") await purgeCourse(item.id);
          else await purgeThread(item.id);
          continue;
        }
        // A genuinely newer edit supersedes an older deletion marker.
        tombstones.delete(id);
      }
      return kept;
    };

    const liveCourses = await keepOrRemove(courses, "course");
    const liveChats = await keepOrRemove(chats, "chat");
    const priorIds = new Set(localTombstones.map(row => row.id));
    for (const row of tombstones.values()) await saveTombstone(row);
    for (const id of priorIds) if (!tombstones.has(id)) await deleteTombstone(id);

    for (const course of liveCourses) await saveCourse(course);
    for (const thread of liveChats) await saveThread(thread);

    const deletions = [...tombstones.values()].map(row => ({ type: row.type, id: row.recordId, deletedAt: row.deletedAt }));
    // Keep each request comfortably below the Worker body limit, even after many offline deletes.
    for (let offset = 0; offset < deletions.length; offset += 500) {
      await accountApi("/api/sync/deletions", "PUT", { deletions: deletions.slice(offset, offset + 500) });
    }
    await accountApi("/api/sync/courses", "PUT", { records: liveCourses.map(payload => ({ id: payload.id, payload })) });
    await accountApi("/api/sync/chats", "PUT", { records: liveChats.map(payload => ({ id: payload.id, payload })) });
    return { courses: liveCourses.length, chats: liveChats.length };
  })().finally(() => {
    syncInProgress = false;
    activeSync = null;
  });

  return activeSync;
}
