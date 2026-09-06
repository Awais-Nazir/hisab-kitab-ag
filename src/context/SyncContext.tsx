"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getPendingSyncCount, getSyncQueue, removeSyncQueueItem } from "@/lib/idb";

interface SyncContextType {
    isOnline: boolean;
    pendingCount: number;
    isSyncing: boolean;
    lastSyncTime: number | null;
    syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    syncNow: async () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== "undefined" ? navigator.onLine : true
    );
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

    const isSyncingRef = useRef<boolean>(false);

    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await getPendingSyncCount();
            setPendingCount(count);
            return count;
        } catch {
            setPendingCount(0);
            return 0;
        }
    }, []);

    const syncNow = useCallback(async () => {
        if (typeof window === "undefined" || !navigator.onLine || isSyncingRef.current) {
            return;
        }

        try {
            const queue = await getSyncQueue();
            if (queue.length === 0) {
                setPendingCount(0);
                return; // Nothing to sync, do not toggle isSyncing
            }

            isSyncingRef.current = true;
            setIsSyncing(true);
            setPendingCount(queue.length);

            let syncedAny = false;

            for (const item of queue) {
                try {
                    const res = await fetch(item.url, {
                        method: item.method,
                        headers: { "Content-Type": "application/json" },
                        body: item.body ? JSON.stringify(item.body) : undefined,
                    });

                    // 2xx success or 4xx unrecoverable client error -> remove from queue so it doesn't jam
                    if (res.ok || (res.status >= 400 && res.status < 500)) {
                        await removeSyncQueueItem(item.id);
                        syncedAny = true;
                    } else if (res.status >= 500) {
                        // Server error, pause and retry later
                        break;
                    }
                } catch {
                    // Network dropped again
                    break;
                }
            }

            const remaining = await getPendingSyncCount();
            setPendingCount(remaining);

            if (syncedAny) {
                setLastSyncTime(Date.now());
                // Dispatch event so active pages know they can silently refresh fresh server data
                window.dispatchEvent(new CustomEvent("offline-sync-completed"));
            }
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        function handleOnline() {
            setIsOnline(true);
            refreshPendingCount().then((count) => {
                if (count > 0) {
                    setTimeout(() => {
                        syncNow();
                    }, 500);
                }
            });
        }

        function handleOffline() {
            setIsOnline(false);
            refreshPendingCount();
        }

        function handleMutationQueued() {
            refreshPendingCount();
        }

        function handleVisibilityChange() {
            if (document.visibilityState === "visible" && navigator.onLine) {
                refreshPendingCount().then((count) => {
                    if (count > 0) {
                        syncNow();
                    }
                });
            }
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener("offline-mutation-queued", handleMutationQueued);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Initial check on mount: only sync if there are actually pending items!
        refreshPendingCount().then((count) => {
            if (navigator.onLine && count > 0) {
                syncNow();
            }
        });

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("offline-mutation-queued", handleMutationQueued);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [refreshPendingCount, syncNow]);

    return (
        <SyncContext.Provider
            value={{
                isOnline,
                pendingCount,
                isSyncing,
                lastSyncTime,
                syncNow,
            }}
        >
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    return useContext(SyncContext);
}
