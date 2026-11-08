import { getThread, saveThread } from "../database/chats";
import type { ChatThread } from "../types/chat";
import type { Level } from "../types/course";
import { askTeacher } from "./aiClient";
import type { TeacherContext } from "./aiClient";

export const threadId = {
  general: "general",
  course: (courseId: string) => `course:${courseId}`,
  lesson: (courseId: string, lessonId: string) => `lesson:${courseId}:${lessonId}`
};

const MAX_STORED = 100;
const cap = (t: ChatThread): ChatThread => ({ ...t, messages: t.messages.slice(-MAX_STORED) });

export async function loadThread(id: string): Promise<ChatThread> {
  return (await getThread(id)) ?? { id, messages: [], updatedAt: Date.now() };
}

/** Save the learner's message first, so it is never lost even if the AI call fails. */
export async function appendUser(t: ChatThread, text: string): Promise<ChatThread> {
  const next = cap({ ...t, messages: [...t.messages, { role: "user", content: text, at: Date.now() }], updatedAt: Date.now() });
  await saveThread(next);
  return next;
}

/** Ask the teacher about the conversation so far (last message must be the learner's) and store the reply. */
export async function getReply(t: ChatThread, level: Level, context: TeacherContext): Promise<ChatThread> {
  const reply = await askTeacher(level, context, t.messages.map(m => ({ role: m.role, content: m.content })));
  const next = cap({ ...t, messages: [...t.messages, { role: "assistant", content: reply, at: Date.now() }], updatedAt: Date.now() });
  await saveThread(next);
  return next;
}

export async function clearThread(id: string): Promise<ChatThread> {
  const empty: ChatThread = { id, messages: [], updatedAt: Date.now() };
  await saveThread(empty);
  return empty;
}
