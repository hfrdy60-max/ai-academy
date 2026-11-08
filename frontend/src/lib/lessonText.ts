import type { LessonContent } from "../types/course";

/** Plain-text version of a lesson, used as context for the AI teacher (kept short). */
export function contentToText(c: LessonContent, max = 5800): string {
  const parts = [c.intro, c.objectives.length ? "اهداف:\n- " + c.objectives.join("\n- ") : "", c.explanation, c.summary].filter(Boolean);
  return parts.join("\n\n").slice(0, max);
}
