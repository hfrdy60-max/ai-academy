import { listCourses, saveCourse, purgeCourse } from "../database/courses";
import { listThreads, saveThread, purgeThread } from "../database/chats";
import { accountApi } from "./accountService";
import type { Course } from "../types/course";
import type { ChatThread } from "../types/chat";
import type { Profile } from "../types/settings";
import { getProfileSyncSnapshot, saveSyncedProfile } from "./settingsService";
import { validateCourse, validateThread } from "./validate";
import { deleteTombstone, listTombstones, saveTombstone, tombstoneId, type SyncTombstone } from "../database/tombstones";
import {
  isExamResult, isGameResult, mergeHistories, readExamHistory, readGameHistory, writeSyncedHistories,
  type ExamResult, type GameResult
} from "./resultService";

interface CloudRecord<T> { id: string; payload: T; updated_at: number }
interface CloudResultRecord { id: string; result_type: "exam" | "game"; payload: unknown; updated_at: number }
interface CloudProfile { profile: unknown; updated_at: number }
type SyncSummary = { courses: number; chats: number; exams: number; games: number };
let syncInProgress = false;
let activeSync: Promise<SyncSummary> | null = null;
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

/** Upload bounded batches so a large advanced course does not exceed Worker request limits. */
async function uploadRecordBatches<T extends { id: string; payload: unknown }>(
  path: string, records: T[]
): Promise<void> {
  const maxBatchBytes = 1_700_000;
  let batch: T[] = [];
  for (const record of records) {
    const candidate = [...batch, record];
    const size = new TextEncoder().encode(JSON.stringify({ records: candidate })).byteLength;
    if (batch.length > 0 && (size > maxBatchBytes || candidate.length > 200)) {
      await accountApi(path, "PUT", { records: batch });
      batch = [record];
    } else {
      batch = candidate;
    }
    const singleSize = new TextEncoder().encode(JSON.stringify({ records: [record] })).byteLength;
    if (singleSize > maxBatchBytes) {
      throw new Error("یکی از داده‌های همگام‌سازی از حد مجاز بزرگ‌تر است؛ نسخه پشتیبان تهیه و محتوای آن را بررسی کنید.");
    }
  }
  if (batch.length) await accountApi(path, "PUT", { records: batch });
}

async function uploadDeletionBatches(rows: SyncTombstone[]): Promise<void> {
  const deletions = rows.map(row => ({ type: row.type, id: row.recordId, deletedAt: row.deletedAt }));
  for (let offset = 0; offset < deletions.length; offset += 500) {
    await accountApi("/api/sync/deletions", "PUT", { deletions: deletions.slice(offset, offset + 500) });
  }
}

async function fetchAllPages<T, K extends "records" | "deletions">(
  path: string, key: K, pageSize: number
): Promise<T[]> {
  const collected: T[] = [];
  for (let offset = 0; offset <= 1_000_000; offset += pageSize) {
    const response = await accountApi<Partial<Record<K, unknown>>>(
      `${path}?limit=${pageSize}&offset=${offset}`, "GET"
    );
    const page = response[key];
    if (!Array.isArray(page)) throw new Error("پاسخ صفحه‌بندی همگام‌سازی معتبر نیست.");
    collected.push(...page as T[]);
    if (page.length < pageSize) return collected;
  }
  throw new Error("تعداد داده‌های ابری از حد همگام‌سازی این نسخه بیشتر است.");
}

/** Merge local/cloud records while honoring deletion markers from every signed-in device. */
export function syncAccountData(): Promise<SyncSummary> {
  if (activeSync) return activeSync;

  syncInProgress = true;
  activeSync = (async () => {
    const [localCourses, localChats, localTombstones, localExams, localGames, localProfile] = await Promise.all([
      listCourses(), listThreads(), listTombstones(),
      Promise.resolve(readExamHistory()), Promise.resolve(readGameHistory()),
      getProfileSyncSnapshot()
    ]);

    // Upload locally created deletions before reading remote records. The Worker
    // advances each marker past the current cloud version, preventing client-clock
    // skew from making a deleted cloud copy appear newer and resurrecting it.
    const pendingTombstones = localTombstones.filter(row => row.synced !== true);
    if (pendingTombstones.length) {
      await uploadDeletionBatches(pendingTombstones);
      for (const row of pendingTombstones) await saveTombstone({ ...row, synced: true });
    }

    const [cloudCourses, cloudChats, cloudDeletions, cloudResults, cloudProfile] = await Promise.all([
      fetchAllPages<CloudRecord<Course>, "records">("/api/sync/courses", "records", 25),
      fetchAllPages<CloudRecord<ChatThread>, "records">("/api/sync/chats", "records", 25),
      fetchAllPages<{ record_type: "course" | "chat"; record_id: string; deleted_at: number }, "deletions">("/api/sync/deletions", "deletions", 500),
      accountApi<{ records: CloudResultRecord[] }>("/api/sync/results", "GET"),
      accountApi<CloudProfile>("/api/sync/profile", "GET")
    ]);

    // Pick up deletes made while the initial local snapshot or remote reads were running.
    const currentLocalTombstones = await listTombstones();
    const tombstones = new Map<string, SyncTombstone>();
    for (const row of currentLocalTombstones) tombstones.set(row.id, row);
    for (const row of cloudDeletions) {
      if ((row.record_type !== "course" && row.record_type !== "chat") ||
          typeof row.record_id !== "string" || !Number.isSafeInteger(row.deleted_at) || row.deleted_at < 0) continue;
      const id = tombstoneId(row.record_type, row.record_id);
      const previous = tombstones.get(id);
      if (!previous || row.deleted_at >= previous.deletedAt) {
        tombstones.set(id, { id, type: row.record_type, recordId: row.record_id, deletedAt: row.deleted_at, synced: true });
      }
    }

    const courses = mergeByUpdatedAt(localCourses, cloudCourses, validateCourse);
    const chats = mergeByUpdatedAt(localChats, cloudChats, validateThread);

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
    const priorIds = new Set(currentLocalTombstones.map(row => row.id));
    for (const row of tombstones.values()) await saveTombstone(row);
    for (const id of priorIds) if (!tombstones.has(id)) await deleteTombstone(id);

    for (const course of liveCourses) await saveCourse(course);
    for (const thread of liveChats) await saveThread(thread);

    await uploadRecordBatches("/api/sync/courses", liveCourses.map(payload => ({ id: payload.id, payload })));
    await uploadRecordBatches("/api/sync/chats", liveChats.map(payload => ({ id: payload.id, payload })));

    // A delete can occur while course/chat batches are uploading. Remove any
    // record that raced back into the local snapshot, then send only unacknowledged markers.
    const lateTombstones = (await listTombstones()).filter(row => row.synced !== true);
    if (lateTombstones.length) {
      for (const row of lateTombstones) {
        if (row.type === "course") await purgeCourse(row.recordId);
        else await purgeThread(row.recordId);
      }
      await uploadDeletionBatches(lateTombstones);
      for (const row of lateTombstones) await saveTombstone({ ...row, synced: true });
    }

    const remoteExams = (cloudResults.records ?? [])
      .filter(row => row && row.result_type === "exam" && row.payload &&
        typeof row.payload === "object" && (row.payload as Record<string, unknown>).id === row.id)
      .map(row => row.payload);
    const remoteGames = (cloudResults.records ?? [])
      .filter(row => row && row.result_type === "game" && row.payload &&
        typeof row.payload === "object" && (row.payload as Record<string, unknown>).id === row.id)
      .map(row => row.payload);
    const exams: ExamResult[] = mergeHistories(localExams, remoteExams, isExamResult);
    const games: GameResult[] = mergeHistories(localGames, remoteGames, isGameResult);
    writeSyncedHistories(exams, games);
    const resultRecords = [
      ...exams.map(payload => ({ id: payload.id, type: "exam", payload })),
      ...games.map(payload => ({ id: payload.id, type: "game", payload }))
    ];
    await accountApi("/api/sync/results", "PUT", { records: resultRecords });

    const remoteProfileValue = cloudProfile.profile;
    const remoteProfile = remoteProfileValue && typeof remoteProfileValue === "object" &&
      !Array.isArray(remoteProfileValue) &&
      typeof (remoteProfileValue as Record<string, unknown>).displayName === "string" &&
      ((remoteProfileValue as Record<string, unknown>).displayName as string).length <= 40 &&
      Number.isInteger((remoteProfileValue as Record<string, unknown>).dailyGoal) &&
      ((remoteProfileValue as Record<string, unknown>).dailyGoal as number) >= 1 &&
      ((remoteProfileValue as Record<string, unknown>).dailyGoal as number) <= 10
      ? remoteProfileValue as Profile : null;
    const remoteProfileUpdatedAt = Number.isSafeInteger(cloudProfile.updated_at) && cloudProfile.updated_at >= 0
      ? cloudProfile.updated_at : 0;
    if (remoteProfile && remoteProfileUpdatedAt > localProfile.updatedAt) {
      await saveSyncedProfile(remoteProfile, remoteProfileUpdatedAt);
    } else {
      await accountApi("/api/sync/profile", "PUT", {
        profile: localProfile.profile,
        updatedAt: localProfile.updatedAt
      });
    }
    return { courses: liveCourses.length, chats: liveChats.length, exams: exams.length, games: games.length };
  })().finally(() => {
    syncInProgress = false;
    activeSync = null;
  });

  return activeSync;
}
