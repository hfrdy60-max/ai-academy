import type { ChatThread } from "../types/chat";
import { STORE, openDb, withStore } from "./db";

export const getThread = (id: string): Promise<ChatThread | undefined> =>
  withStore<ChatThread | undefined>(STORE.chats, "readonly", s => s.get(id));

export async function saveThread(t: ChatThread, fromSync = false): Promise<void> {
  if (fromSync) {
    await withStore(STORE.chats, "readwrite", store => store.put(t));
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE.chats, "readwrite");
    const store = tx.objectStore(STORE.chats);
    const lookup = store.get(t.id);
    let failure: Error | null = null;
    lookup.onsuccess = () => {
      const current = lookup.result as ChatThread | undefined;
      const currentRevision = Number.isSafeInteger(current?.updatedAt) && (current?.updatedAt as number) >= 0
        ? current?.updatedAt as number : 0;
      const nextRevision = Math.max(t.updatedAt, Date.now(), currentRevision + 1);
      if (!Number.isSafeInteger(nextRevision)) {
        failure = new Error("نسخه ویرایش گفتگو معتبر نیست.");
        tx.abort();
        return;
      }
      store.put(nextRevision === t.updatedAt ? t : { ...t, updatedAt: nextRevision });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(failure ?? tx.error ?? new Error("ذخیره گفتگو ناموفق بود."));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("ذخیره گفتگو لغو شد."));
  });
  window.dispatchEvent(new Event("ai-academy-data-change"));
  window.dispatchEvent(new Event("ai-academy-local-change"));
}

export async function saveThreadIfUnchanged(thread: ChatThread, expectedUpdatedAt: number | null): Promise<boolean> {
  const db = await openDb();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE.chats, "readwrite");
    const store = tx.objectStore(STORE.chats);
    const lookup = store.get(thread.id);
    let saved = false;
    lookup.onsuccess = () => {
      const current = lookup.result as ChatThread | undefined;
      const unchanged = expectedUpdatedAt === null
        ? current === undefined
        : current !== undefined && current.updatedAt === expectedUpdatedAt;
      if (unchanged) {
        store.put(thread);
        saved = true;
      }
    };
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("ai-academy-data-change"));
      resolve(saved);
    };
    tx.onerror = () => reject(tx.error ?? new Error("ذخیره گفتگوی همگام‌شده ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("ذخیره گفتگوی همگام‌شده لغو شد."));
  });
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
