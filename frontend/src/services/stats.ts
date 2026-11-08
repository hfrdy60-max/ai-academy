import type { Course } from "../types/course";

export const XP_PER_LESSON = 10;
export const XP_PER_LEVEL = 100;

/** XP is computed from lessons you completed in your current courses (10 XP each, 100 XP per level). */
export function computeStats(courses: Course[], now = new Date()) {
  const done = courses.flatMap(c => c.chapters.flatMap(ch => ch.lessons)).filter(l => l.completed);
  const xp = done.length * XP_PER_LESSON;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return {
    xp,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpInLevel: xp % XP_PER_LEVEL,
    totalCompleted: done.length,
    todayDone: done.filter(l => (l.completedAt ?? 0) >= todayStart).length
  };
}
