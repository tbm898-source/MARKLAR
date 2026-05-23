import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CreateLogPayload } from "../types.js";
import { createLog } from "./api.js";

interface QueueDB extends DBSchema {
  queue: {
    key: number;
    value: {
      id?: number;
      payload: CreateLogPayload;
      queuedAt: string;
    };
    indexes: { "by-queued": string };
  };
}

const DB_NAME = "fieldpulse-offline";
const STORE = "queue";

let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<QueueDB>(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-queued", "queuedAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueueLog(payload: CreateLogPayload): Promise<void> {
  const db = await getDb();
  await db.add(STORE, {
    payload,
    queuedAt: new Date().toISOString(),
  });
}

export async function drainQueue(): Promise<number> {
  const db = await getDb();
  const items = await db.getAll(STORE);
  let synced = 0;

  for (const item of items) {
    try {
      await createLog(item.payload);
      if (item.id !== undefined) {
        await db.delete(STORE, item.id);
      }
      synced++;
    } catch {
      break;
    }
  }

  return synced;
}

export function setupOfflineSync(): void {
  const run = () => {
    void drainQueue();
  };
  window.addEventListener("online", run);
  run();
}
