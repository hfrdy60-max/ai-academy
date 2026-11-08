import type { Env, Task } from "../types";
import { createOpenRouter } from "./openrouter";
import type { AiProvider } from "./types";

// Add a Gemini adapter here later; the rest of the Worker only depends on AiProvider.
export const getProvider = (env: Env): AiProvider => createOpenRouter(env);

/** Different models can be assigned to different tasks through Worker variables. */
export function modelFor(env: Env, task: Task): string {
  const byTask: Record<Task, string | undefined> = {
    outline: env.MODEL_OUTLINE, lesson: env.MODEL_LESSON, chat: env.MODEL_CHAT, check: env.MODEL_CHECK
  };
  return byTask[task] || env.MODEL_DEFAULT || "openai/gpt-4o-mini";
}
