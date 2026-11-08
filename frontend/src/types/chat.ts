export interface ChatMessage { role: "user" | "assistant"; content: string; at: number }

/** One conversation. id = "general", "course:<id>" or "lesson:<courseId>:<lessonId>". */
export interface ChatThread { id: string; messages: ChatMessage[]; updatedAt: number }
