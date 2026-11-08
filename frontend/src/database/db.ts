// Minimal IndexedDB wrapper (no library).
// Version history: 1 = courses. 2 = + settings, chats (existing courses are kept).
const DB_NAME = "ai-academy";
const DB_VERSION = 2;

export const STORE = { courses: "courses", settings: "settings", chats: "chats" } as const;
export type StoreName = (typeof STORE)[keyof typeof STORE];
const KEY_PATH: Record<StoreName, string> = { courses: "id", settings: "key", chats: "id" };

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      dbPromise = null;
      reject(new Error("ذخیره‌سازی محلی (IndexedDB) در این مرورگر یا حالت مرور خصوصی در دسترس نیست."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORE)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: KEY_PATH[name] });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error ?? new Error("باز کردن پایگاه داده ناموفق بود.")); };
    req.onblocked = () => { dbPromise = null; reject(new Error("پایگاه داده توسط تب دیگری قفل شده است. سایر تب‌های برنامه را ببندید.")); };
  });
  return dbPromise;
}

/** Run one request and resolve only after the transaction is committed (so data really is saved). */
export async function withStore<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result!: T;
    const req = run(tx.objectStore(store));
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("عملیات ذخیره‌سازی ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("عملیات ذخیره‌سازی لغو شد (شاید فضای ذخیره‌سازی پر است)."));
  });
}

/** Delete everything stored by the app (courses, chats, settings). */
export async function clearAllData(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(Object.values(STORE), "readwrite");
    for (const name of Object.values(STORE)) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("پاک کردن داده‌ها ناموفق بود."));
    tx.onabort = () => reject(tx.error ?? new Error("پاک کردن داده‌ها لغو شد."));
  });
}

/** Ask the browser not to evict our data when storage is low. Best effort; failure is harmless. */
export async function requestPersistence(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}
