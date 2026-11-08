import type { ChatThread } from "../types/chat";
import { STORE, withStore } from "./db";

export const getThread = (id: string): Promise<ChatThread | undefined> =>
  withStore<ChatThread | undefined>(STORE.chats, "readonly", s => s.get(id));

export async function saveThread(t: ChatThread): Promise<void> {
  await withStore(STORE.chats, "readwrite", s => s.put(t));
}

export async function deleteThread(id: string): Promise<void> {
  await withStore(STORE.chats, "readwrite", s => s.delete(id));
}

export const listThreads = (): Promise<ChatThread[]> => withStore<ChatThread[]>(STORE.chats, "readonly", s => s.getAll());
