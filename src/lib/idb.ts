/**
 * Lightweight, zero-dependency IndexedDB wrapper for Hisab-Kitab
 * Provides persistent local caching and an offline mutation outbox queue.
 */

const DB_NAME = "hisab_kitab_offline_db";
const DB_VERSION = 1;
const CACHE_STORE = "api_cache";
const SYNC_QUEUE_STORE = "sync_queue";

export interface SyncQueueItem {
    id: string;
    url: string;
    method: string;
    body: any;
    createdAt: number;
    retries: number;
    description?: string;
}

function openDB(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                db.createObjectStore(CACHE_STORE, { keyPath: "url" });
            }
            if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
                db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.error("IndexedDB open error:", request.error);
            resolve(null); // gracefully fallback without breaking app
        };
    });
}

/**
 * Retrieve cached API response by URL
 */
export async function getCachedApi<T = any>(url: string): Promise<T | null> {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(CACHE_STORE, "readonly");
            const store = tx.objectStore(CACHE_STORE);
            const req = store.get(url);

            req.onsuccess = () => {
                if (req.result && req.result.data !== undefined) {
                    resolve(req.result.data as T);
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

/**
 * Cache API response by URL
 */
export async function setCachedApi(url: string, data: any): Promise<void> {
    const db = await openDB();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(CACHE_STORE, "readwrite");
            const store = tx.objectStore(CACHE_STORE);
            store.put({ url, data, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/**
 * Add a pending mutation to the offline sync queue
 */
export async function addToSyncQueue(
    mutation: { url: string; method: string; body: any; description?: string }
): Promise<SyncQueueItem | null> {
    const db = await openDB();
    if (!db) return null;

    const item: SyncQueueItem = {
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: mutation.url,
        method: mutation.method,
        body: mutation.body,
        createdAt: Date.now(),
        retries: 0,
        description: mutation.description,
    };

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            store.put(item);
            tx.oncomplete = () => resolve(item);
            tx.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

/**
 * Get all pending mutations sorted chronologically
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await openDB();
    if (!db) return [];

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            const req = store.getAll();

            req.onsuccess = () => {
                const list = (req.result || []) as SyncQueueItem[];
                list.sort((a, b) => a.createdAt - b.createdAt);
                resolve(list);
            };
            req.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });
}

/**
 * Remove an item from the sync queue after successful replay
 */
export async function removeSyncQueueItem(id: string): Promise<void> {
    const db = await openDB();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/**
 * Count pending mutations in queue
 */
export async function getPendingSyncCount(): Promise<number> {
    const db = await openDB();
    if (!db) return 0;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            const req = store.count();

            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
        } catch {
            resolve(0);
        }
    });
}

/**
 * Clear all sync queue items
 */
export async function clearSyncQueue(): Promise<void> {
    const db = await openDB();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}
