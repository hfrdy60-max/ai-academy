// Pure helpers used by the course editor: each returns a NEW course and never touches the database.
import { newId } from "../lib/id";
import type { Course } from "../types/course";

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const a = arr.slice();
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

export const addChapter = (c: Course, title: string): Course =>
  ({ ...c, chapters: [...c.chapters, { id: newId(), title, lessons: [] }] });

export const renameChapter = (c: Course, chapterId: string, title: string): Course =>
  ({ ...c, chapters: c.chapters.map(ch => ch.id === chapterId ? { ...ch, title } : ch) });

export const removeChapter = (c: Course, chapterId: string): Course =>
  ({ ...c, chapters: c.chapters.filter(ch => ch.id !== chapterId) });

export const moveChapter = (c: Course, chapterId: string, dir: -1 | 1): Course => {
  const i = c.chapters.findIndex(ch => ch.id === chapterId);
  return i < 0 ? c : { ...c, chapters: swap(c.chapters, i, i + dir) };
};

export const addLesson = (c: Course, chapterId: string, title: string): Course =>
  ({ ...c, chapters: c.chapters.map(ch => ch.id === chapterId ? { ...ch, lessons: [...ch.lessons, { id: newId(), title, completed: false }] } : ch) });

export const renameLesson = (c: Course, chapterId: string, lessonId: string, title: string): Course =>
  ({ ...c, chapters: c.chapters.map(ch => ch.id === chapterId ? { ...ch, lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, title } : l) } : ch) });

export const removeLesson = (c: Course, chapterId: string, lessonId: string): Course =>
  ({ ...c, chapters: c.chapters.map(ch => ch.id === chapterId ? { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) } : ch) });

export const moveLesson = (c: Course, chapterId: string, lessonId: string, dir: -1 | 1): Course =>
  ({ ...c, chapters: c.chapters.map(ch => {
    if (ch.id !== chapterId) return ch;
    const i = ch.lessons.findIndex(l => l.id === lessonId);
    return i < 0 ? ch : { ...ch, lessons: swap(ch.lessons, i, i + dir) };
  }) });
