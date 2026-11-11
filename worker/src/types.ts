export interface Env {
  ALLOWED_ORIGIN: string;
  DB?: D1Database;
  ACCESS_TOKEN?: string;           // Legacy shared token for existing AI endpoints until frontend auth migration is complete.
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  MODEL_DEFAULT?: string;
  MODEL_OUTLINE?: string;
  MODEL_LESSON?: string;
  MODEL_CHAT?: string;
  MODEL_CHECK?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  AUTH_RATE_LIMIT_PER_MINUTE?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  UPSTREAM_RETRY_BASE_MS?: string;
  RESEND_API_KEY?: string;         // Secret: transactional email delivery.
  EMAIL_FROM?: string;             // Verified sender, e.g. AI Academy <login@example.com>.
  AUTH_PEPPER?: string;            // Secret random value used when hashing one-time codes.
}
export type Level = "beginner" | "intermediate" | "advanced";
export type Task = "outline" | "lesson" | "chat" | "check";
