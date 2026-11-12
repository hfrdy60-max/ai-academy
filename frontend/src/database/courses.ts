import type { Course } from "../types/course";
import { STORE, openDb, withStore } from "./db";

export async function listCourses(): Promise<Course[]> {
  const all = await withStore<Course[]>(STORE.courses, "readonly", s => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt); // most recently used first
}

export const getCourse = (id: string): Promise<Course | undefined> =>
  withStore<Course | undefined>(STORE.courses, "readonly", s => s.get(id));

export async function saveCourse(course: Course): Promise<void> {
  await withStore(STORE.courses, "readwrite", s => s.put(course));
}

export async function deleteCourse(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE.courses, STORE.tombstones], "readwrite");
    tx.objectStore(STORE.courses).delete(id);
    const deletedAt = Date.now();
    tx.objectStore(STORE.tombstones).put({
      id: "course:" + id, type: "course", recordId: id, deletedAt
    });
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("ai-academy-data-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("ثبت حذف برای همگام‌سازی ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("حذف لغو شد."));
  });
}
