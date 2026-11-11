export interface ChatMsg { role: "system" | "user" | "assistant"; content: string }
export interface Usage { prompt: number; completion: number; total: number }
export interface CompletionResult { text: string; model: string; finishReason?: string; usage?: Usage }
export interface CompleteOptions { model: string; messages: ChatMsg[]; maxTokens: number; temperature: number }

/** Every AI provider (OpenRouter now, Gemini later) implements this one method. */
export interface AiProvider { complete(opts: CompleteOptions): Promise<CompletionResult> }
