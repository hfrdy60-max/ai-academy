import type { Course } from "../types/course";
import { STORE, withStore } from "./db";

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
  await withStore(STORE.courses, "readwrite", s => s.delete(id));
}
