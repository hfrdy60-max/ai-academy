import type { ChatThread } from "../types/chat";
import { STORE, openDb, withStore } from "./db";

export const getThread = (id: string): Promise<ChatThread | undefined> =>
  withStore<ChatThread | undefined>(STORE.chats, "readonly", s => s.get(id));

export async function saveThread(t: ChatThread): Promise<void> {
  await withStore(STORE.chats, "readwrite", s => s.put(t));
}

export async function deleteThread(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE.chats, STORE.tombstones], "readwrite");
    tx.objectStore(STORE.chats).delete(id);
    const deletedAt = Date.now();
    tx.objectStore(STORE.tombstones).put({
      id: "chat:" + id, type: "chat", recordId: id, deletedAt
    });
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("ai-academy-data-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("ثبت حذف برای همگام‌سازی ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("حذف لغو شد."));
  });
}

export const listThreads = (): Promise<ChatThread[]> => withStore<ChatThread[]>(STORE.chats, "readonly", s => s.getAll());
