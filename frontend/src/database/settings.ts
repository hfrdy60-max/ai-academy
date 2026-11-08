import { STORE, withStore } from "./db";

interface Row { key: string; value: unknown }

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await withStore<Row | undefined>(STORE.settings, "readonly", s => s.get(key));
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await withStore(STORE.settings, "readwrite", s => s.put({ key, value } satisfies Row));
}
