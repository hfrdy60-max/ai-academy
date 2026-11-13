import type { Course } from "../types/course";
import { STORE, openDb, withStore } from "./db";

export async function listCourses(): Promise<Course[]> {
  const all = await withStore<Course[]>(STORE.courses, "readonly", s => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt); // most recently used first
}

export const getCourse = (id: string): Promise<Course | undefined> =>
  withStore<Course | undefined>(STORE.courses, "readonly", s => s.get(id));

export async function saveCourse(course: Course, fromSync = false): Promise<void> {
  await withStore(STORE.courses, "readwrite", s => s.put(course));
  if (!fromSync) window.dispatchEvent(new Event("ai-academy-local-change"));
}

/** Remove a locally stale copy while applying a tombstone received from the cloud. */
export async function purgeCourse(id: string): Promise<void> {
  await withStore(STORE.courses, "readwrite", store => store.delete(id));
}

export async function deleteCourse(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE.courses, STORE.tombstones], "readwrite");
    const recordStore = tx.objectStore(STORE.courses);
    const lookup = recordStore.get(id);
    lookup.onsuccess = () => {
      const current = lookup.result as { updatedAt?: unknown } | undefined;
      const previousUpdatedAt = Number.isSafeInteger(current?.updatedAt) && (current?.updatedAt as number) >= 0
        ? current?.updatedAt as number : 0;
      const deletedAt = Math.max(Date.now(), previousUpdatedAt + 1);
      recordStore.delete(id);
      tx.objectStore(STORE.tombstones).put({
        id: "course:" + id, type: "course", recordId: id, deletedAt, synced: false
      });
    };
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("ai-academy-data-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("ثبت حذف برای همگام‌سازی ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("حذف لغو شد."));
  });
}
