export interface Env {
  ALLOWED_ORIGIN: string;          // frontend origin only, e.g. https://user.github.io
  ACCESS_TOKEN?: string;           // SECRET: shared token the frontend must send (required)
  OPENROUTER_API_KEY?: string;     // SECRET: never leaves the Worker
  OPENROUTER_BASE_URL?: string;    // optional override (https, or http://localhost for tests)
  MODEL_DEFAULT?: string;          // OpenRouter model id used when no task-specific model is set
  MODEL_OUTLINE?: string;
  MODEL_LESSON?: string;
  MODEL_CHAT?: string;
  MODEL_CHECK?: string;
  RATE_LIMIT_PER_MINUTE?: string;  // default 30 (per client IP, per Worker instance)
  UPSTREAM_TIMEOUT_MS?: string;    // default 50000
  UPSTREAM_RETRY_BASE_MS?: string; // default 400
}

export type Level = "beginner" | "intermediate" | "advanced";
export type Task = "outline" | "lesson" | "chat" | "check";
