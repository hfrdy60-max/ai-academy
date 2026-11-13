import type { ChatThread } from "../types/chat";
import { STORE, openDb, withStore } from "./db";

export const getThread = (id: string): Promise<ChatThread | undefined> =>
  withStore<ChatThread | undefined>(STORE.chats, "readonly", s => s.get(id));

export async function saveThread(t: ChatThread, fromSync = false): Promise<void> {
  await withStore(STORE.chats, "readwrite", s => s.put(t));
  if (!fromSync) window.dispatchEvent(new Event("ai-academy-local-change"));
}

/** Remove a locally stale copy while applying a tombstone received from the cloud. */
export async function purgeThread(id: string): Promise<void> {
  await withStore(STORE.chats, "readwrite", store => store.delete(id));
}

export async function deleteThread(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE.chats, STORE.tombstones], "readwrite");
    const recordStore = tx.objectStore(STORE.chats);
    const lookup = recordStore.get(id);
    lookup.onsuccess = () => {
      const current = lookup.result as { updatedAt?: unknown } | undefined;
      const previousUpdatedAt = Number.isSafeInteger(current?.updatedAt) && (current?.updatedAt as number) >= 0
        ? current?.updatedAt as number : 0;
      const deletedAt = Math.max(Date.now(), previousUpdatedAt + 1);
      recordStore.delete(id);
      tx.objectStore(STORE.tombstones).put({
        id: "chat:" + id, type: "chat", recordId: id, deletedAt, synced: false
      });
    };
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("ai-academy-data-change"));
      window.dispatchEvent(new Event("ai-academy-local-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("ثبت حذف برای همگام‌سازی ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("حذف لغو شد."));
  });
}

export const listThreads = (): Promise<ChatThread[]> => withStore<ChatThread[]>(STORE.chats, "readonly", s => s.getAll());
