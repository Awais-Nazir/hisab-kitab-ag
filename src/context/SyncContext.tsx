"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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

    useEffect(() => {
        if (typeof window === "undefined") return;

        function handleOnline() {
            setIsOnline(true);
        }
        function handleOffline() {
            setIsOnline(false);
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const syncNow = useCallback(async () => {}, []);

    return (
        <SyncContext.Provider
            value={{
                isOnline,
                pendingCount: 0,
                isSyncing: false,
                lastSyncTime: null,
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
