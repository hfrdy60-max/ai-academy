import { STORE, openDb, withStore } from "./db";

interface Row { key: string; value: unknown }

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await withStore<Row | undefined>(STORE.settings, "readonly", s => s.get(key));
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await withStore(STORE.settings, "readwrite", s => s.put({ key, value } satisfies Row));
}


/** Persist related settings atomically in one IndexedDB transaction. */
export async function setSettings(values: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(values);
  if (entries.some(([key]) => !key || key.length > 100)) throw new Error("شناسه تنظیمات نامعتبر است.");
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE.settings, "readwrite");
    const store = tx.objectStore(STORE.settings);
    for (const [key, value] of entries) store.put({ key, value } satisfies Row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("ذخیره تنظیمات ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("ذخیره تنظیمات لغو شد."));
  });
}
