import { STORE, withStore } from "./db";

export interface SyncTombstone {
  id: string;
  type: "course" | "chat";
  recordId: string;
  deletedAt: number;
}

export const tombstoneId = (type: SyncTombstone["type"], recordId: string) => `${type}:${recordId}`;

export async function listTombstones(): Promise<SyncTombstone[]> {
  const rows = await withStore<SyncTombstone[]>(STORE.tombstones, "readonly", store => store.getAll());
  return rows.filter(row =>
    row && (row.type === "course" || row.type === "chat") &&
    typeof row.recordId === "string" && Number.isSafeInteger(row.deletedAt) && row.deletedAt >= 0
  );
}

export async function saveTombstone(row: SyncTombstone): Promise<void> {
  await withStore(STORE.tombstones, "readwrite", store => store.put(row));
}
